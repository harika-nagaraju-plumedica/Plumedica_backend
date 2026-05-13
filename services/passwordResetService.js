const bcrypt = require("bcryptjs");
const AppError = require("../utils/AppError");
const passwordResetRepository = require("../repositories/passwordResetRepository");
const {
  normalizeIdentifier,
  isValidEmail,
  isValidPhone,
  validatePasswordPolicy,
  isValidResetTokenFormat,
} = require("../utils/passwordResetValidation");
const { generateRawResetToken, hashSensitiveValue } = require("../utils/passwordResetSecurity");
const {
  getModuleConfig,
  normalizeModuleKey,
  findByIdentifier,
  findMatchesByIdentifier,
  getModuleKeyByRole,
  parseObjectId,
} = require("../utils/passwordResetModules");
const { sendEmailResetInstructions, sendSmsResetInstructions } = require("../utils/passwordResetNotifier");

const RESET_TOKEN_TTL_MINUTES = Math.max(parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 10) || 15, 5);
const RESET_RATE_LIMIT_WINDOW_MINUTES = Math.max(parseInt(process.env.FORGOT_PASSWORD_WINDOW_MINUTES, 10) || 15, 1);
const RESET_RATE_LIMIT_MAX_ATTEMPTS = Math.max(parseInt(process.env.FORGOT_PASSWORD_MAX_ATTEMPTS, 10) || 5, 1);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const EXPOSE_RESET_TOKEN_IN_FORGOT_PASSWORD_RESPONSE = !IS_PRODUCTION;
const RESET_PASSWORD_TEST_BASE_URL = String(process.env.RESET_PASSWORD_TEST_BASE_URL || "http://localhost:3000/reset-password").trim();

const FORGOT_PASSWORD_RESPONSE_MESSAGE = "Reset instructions sent";

const buildResetUrl = (token) => {
  const trimmedBase = RESET_PASSWORD_TEST_BASE_URL.replace(/\/+$/, "");
  return `${trimmedBase}/${token}`;
};

const resolveModuleForForgotPassword = async ({ moduleKey, authRole, identifierCanonical, identifierIsEmail }) => {
  const explicitModule = normalizeModuleKey(moduleKey);
  if (moduleKey && !explicitModule) {
    throw new AppError("Invalid module value", 400, "INVALID_MODULE");
  }

  if (explicitModule) {
    return explicitModule;
  }

  const matches = await findMatchesByIdentifier(identifierCanonical, identifierIsEmail);
  if (matches.length === 1) {
    return matches[0].moduleKey;
  }

  if (matches.length > 1) {
    throw new AppError(
      "Multiple accounts found for this identifier. Please provide module in request body.",
      409,
      "MULTIPLE_MATCHING_MODULES"
    );
  }

  const jwtModule = getModuleKeyByRole(authRole);
  if (jwtModule) {
    return jwtModule;
  }

  return null;
};

const sendResetInstructions = async ({ moduleKey, identifier, token, expiresInMinutes }) => {
  const isEmail = isValidEmail(identifier);
  const result = isEmail
    ? await sendEmailResetInstructions({
      to: identifier,
      moduleKey,
      token,
      expiresInMinutes,
    })
    : await sendSmsResetInstructions({
      to: identifier,
      moduleKey,
      token,
      expiresInMinutes,
    });

  if (!result.delivered) {
    console.error("[password-reset] delivery failed", {
      moduleKey,
      channel: isEmail ? "email" : "sms",
      reason: result.reason || "UNKNOWN",
    });
  }

  return result;
};

const forgotPassword = async ({ moduleKey, authRole, identifier, ipAddress }) => {

  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    throw new AppError("identifier is required", 400, "MISSING_IDENTIFIER");
  }

  const identifierIsEmail = isValidEmail(normalizedIdentifier);
  const identifierIsPhone = isValidPhone(normalizedIdentifier);

  if (!identifierIsEmail && !identifierIsPhone) {
    throw new AppError("identifier must be a valid email or E.164 phone", 400, "INVALID_IDENTIFIER_FORMAT");
  }

  const identifierCanonical = identifierIsEmail
    ? normalizedIdentifier.toLowerCase()
    : normalizedIdentifier;

  const normalizedModule = await resolveModuleForForgotPassword({
    moduleKey,
    authRole,
    identifierCanonical,
    identifierIsEmail,
  });

  const moduleConfig = normalizedModule ? getModuleConfig(normalizedModule) : null;

  const identifierHash = hashSensitiveValue(identifierCanonical);
  const ipHash = hashSensitiveValue(String(ipAddress || "unknown"));
  const now = new Date();
  const windowStart = new Date(now.getTime() - RESET_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const rateLimitModuleKey = normalizedModule || "global";

  const requestCount = await passwordResetRepository.countForgotPasswordRequests({
    moduleKey: rateLimitModuleKey,
    identifierHash,
    ipHash,
    since: windowStart,
  });

  if (requestCount >= RESET_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new AppError("Too many password reset attempts. Please try again later.", 429, "RATE_LIMITED_FORGOT_PASSWORD");
  }

  const requestExpiresAt = new Date(now.getTime() + RESET_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  await passwordResetRepository.recordForgotPasswordRequest({
    moduleKey: rateLimitModuleKey,
    identifierHash,
    ipHash,
    expiresAt: requestExpiresAt,
  });

  if (!normalizedModule || !moduleConfig) {
    return {
      message: FORGOT_PASSWORD_RESPONSE_MESSAGE,
      data: {},
    };
  }

  const user = await findByIdentifier(normalizedModule, identifierCanonical, identifierIsEmail);
  let resetTokenForResponse = null;

  if (!user && EXPOSE_RESET_TOKEN_IN_FORGOT_PASSWORD_RESPONSE) {
    throw new AppError(
      "No account found for this identifier. Use a registered account to receive resetToken in development.",
      404,
      "ACCOUNT_NOT_FOUND_FOR_PASSWORD_RESET"
    );
  }

  if (user) {
    await passwordResetRepository.deleteActiveTokensForUser({
      moduleKey: normalizedModule,
      userId: user._id,
    });

    const rawToken = generateRawResetToken();
    resetTokenForResponse = rawToken;
    const tokenHash = hashSensitiveValue(rawToken);
    const tokenExpiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await passwordResetRepository.createResetToken({
      moduleKey: normalizedModule,
      userId: user._id,
      identifierHash,
      tokenHash,
      expiresAt: tokenExpiresAt,
    });

    await sendResetInstructions({
      moduleKey: normalizedModule,
      identifier: identifierCanonical,
      token: rawToken,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  }

  return {
    message: FORGOT_PASSWORD_RESPONSE_MESSAGE,
    data:
      EXPOSE_RESET_TOKEN_IN_FORGOT_PASSWORD_RESPONSE && resetTokenForResponse
        ? {
          resetToken: resetTokenForResponse,
          resetUrl: buildResetUrl(resetTokenForResponse),
        }
        : {},
  };
};

const resetPassword = async ({ moduleKey, authRole, token, newPassword, confirmPassword }) => {
  const normalizedModule = normalizeModuleKey(moduleKey);
  if (moduleKey && !normalizedModule) {
    throw new AppError("Invalid module value", 400, "INVALID_MODULE");
  }

  const normalizedToken = String(token || "").trim().toLowerCase();
  if (!normalizedToken) {
    throw new AppError(
      "Reset token is required. Provide it via URL (/api/auth/reset-password/:token), query (?token=), x-reset-token header, Authorization Bearer token, or body token.",
      400,
      "MISSING_RESET_TOKEN"
    );
  }

  if (!isValidResetTokenFormat(normalizedToken)) {
    throw new AppError("Invalid reset token format", 400, "INVALID_RESET_TOKEN_FORMAT");
  }

  const { isValid, failures } = validatePasswordPolicy(newPassword);
  if (!isValid) {
    throw new AppError(failures.join(". "), 400, "WEAK_PASSWORD");
  }

  if (String(newPassword) !== String(confirmPassword)) {
    throw new AppError("newPassword and confirmPassword must match", 400, "PASSWORD_MISMATCH");
  }

  const tokenHash = hashSensitiveValue(normalizedToken);
  let storedToken = null;

  if (normalizedModule) {
    storedToken = await passwordResetRepository.findActiveTokenByHash({
      moduleKey: normalizedModule,
      tokenHash,
    });
  } else {
    const jwtModule = getModuleKeyByRole(authRole);

    if (jwtModule) {
      storedToken = await passwordResetRepository.findActiveTokenByHash({
        moduleKey: jwtModule,
        tokenHash,
      });
    }

    if (!storedToken) {
      storedToken = await passwordResetRepository.findActiveTokenByHashAnyModule({ tokenHash });
    }
  }

  if (!storedToken) {
    throw new AppError("Invalid or already used reset token", 400, "INVALID_OR_USED_RESET_TOKEN");
  }

  const moduleConfig = getModuleConfig(storedToken.moduleKey);
  if (!moduleConfig) {
    throw new AppError("Invalid module value", 400, "INVALID_MODULE");
  }

  if (storedToken.expiresAt.getTime() < Date.now()) {
    throw new AppError("Reset token has expired", 400, "EXPIRED_RESET_TOKEN");
  }

  const userId = parseObjectId(storedToken.userId);
  const user = userId ? await moduleConfig.model.findById(userId) : null;
  if (!user) {
    throw new AppError("Invalid reset token", 400, "INVALID_RESET_TOKEN");
  }

  user.password = await bcrypt.hash(String(newPassword), 12);
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();

  await passwordResetRepository.markTokenUsed(storedToken._id);
  await passwordResetRepository.deleteActiveTokensForUser({
    moduleKey: storedToken.moduleKey,
    userId: user._id,
  });

  return {
    message: "Password reset successful",
  };
};

module.exports = {
  forgotPassword,
  resetPassword,
};
