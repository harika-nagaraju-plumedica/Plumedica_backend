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
const { getModuleConfig, normalizeModuleKey, findByIdentifier, parseObjectId } = require("../utils/passwordResetModules");
const { sendEmailResetInstructions, sendSmsResetInstructions } = require("../utils/passwordResetNotifier");

const RESET_TOKEN_TTL_MINUTES = Math.max(parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 10) || 15, 5);
const RESET_RATE_LIMIT_WINDOW_MINUTES = Math.max(parseInt(process.env.FORGOT_PASSWORD_WINDOW_MINUTES, 10) || 15, 1);
const RESET_RATE_LIMIT_MAX_ATTEMPTS = Math.max(parseInt(process.env.FORGOT_PASSWORD_MAX_ATTEMPTS, 10) || 5, 1);

const GENERIC_FORGOT_RESPONSE = "If the account exists, reset instructions have been sent";

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

const forgotPassword = async ({ moduleKey, identifier, ipAddress }) => {
  const normalizedModule = normalizeModuleKey(moduleKey);
  const moduleConfig = getModuleConfig(normalizedModule);

  if (!moduleConfig) {
    throw new AppError("Invalid module value", 400, "INVALID_MODULE");
  }

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

  const identifierHash = hashSensitiveValue(identifierCanonical);
  const ipHash = hashSensitiveValue(String(ipAddress || "unknown"));
  const now = new Date();
  const windowStart = new Date(now.getTime() - RESET_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  const requestCount = await passwordResetRepository.countForgotPasswordRequests({
    moduleKey: normalizedModule,
    identifierHash,
    ipHash,
    since: windowStart,
  });

  if (requestCount >= RESET_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new AppError("Too many password reset attempts. Please try again later.", 429, "RATE_LIMITED_FORGOT_PASSWORD");
  }

  const requestExpiresAt = new Date(now.getTime() + RESET_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  await passwordResetRepository.recordForgotPasswordRequest({
    moduleKey: normalizedModule,
    identifierHash,
    ipHash,
    expiresAt: requestExpiresAt,
  });

  const user = await findByIdentifier(normalizedModule, identifierCanonical, identifierIsEmail);

  if (user) {
    await passwordResetRepository.deleteActiveTokensForUser({
      moduleKey: normalizedModule,
      userId: user._id,
    });

    const rawToken = generateRawResetToken();
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
    message: GENERIC_FORGOT_RESPONSE,
  };
};

const resetPassword = async ({ moduleKey, token, newPassword, confirmPassword }) => {
  const normalizedModule = normalizeModuleKey(moduleKey);
  const moduleConfig = getModuleConfig(normalizedModule);

  if (!moduleConfig) {
    throw new AppError("Invalid module value", 400, "INVALID_MODULE");
  }

  const normalizedToken = String(token || "").trim().toLowerCase();
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
  const storedToken = await passwordResetRepository.findActiveTokenByHash({
    moduleKey: normalizedModule,
    tokenHash,
  });

  if (!storedToken) {
    throw new AppError("Invalid or already used reset token", 400, "INVALID_OR_USED_RESET_TOKEN");
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
    moduleKey: normalizedModule,
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
