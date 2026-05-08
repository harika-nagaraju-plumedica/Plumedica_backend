const asyncHandler = require("../../utils/asyncHandler");
const jwt = require("jsonwebtoken");
const sendResponse = require("../../utils/apiResponse");
const passwordResetService = require("../../services/passwordResetService");

const getBearerToken = (authorizationHeader = "") => {
  const [scheme, token] = String(authorizationHeader).split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const extractResetToken = (req) => {
  const fromParam = String(req.params?.token || "").trim();
  if (fromParam) {
    return fromParam;
  }

  const fromQuery = String(req.query?.token || "").trim();
  if (fromQuery) {
    return fromQuery;
  }

  const fromHeader = String(req.headers["x-reset-token"] || "").trim();
  if (fromHeader) {
    return fromHeader;
  }

  const fromAuthBearer = getBearerToken(req.headers.authorization || "");
  if (fromAuthBearer) {
    return fromAuthBearer;
  }

  return String(req.body?.token || req.body?.resetToken || "").trim();
};

const getOptionalAuthRole = (req) => {
  const token = getBearerToken(req.headers.authorization || "");
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "replace-this-secret-in-production");
    return decoded.role || null;
  } catch (error) {
    return null;
  }
};

const buildPasswordResetController = (moduleKey) => {
  const forgotPassword = asyncHandler(async (req, res) => {
    const result = await passwordResetService.forgotPassword({
      moduleKey,
      authRole: getOptionalAuthRole(req),
      identifier: req.body.identifier,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    });

    return sendResponse(res, 200, true, result.message, result.data || {}, null);
  });

  const resetPassword = asyncHandler(async (req, res) => {
    const result = await passwordResetService.resetPassword({
      moduleKey,
      authRole: getOptionalAuthRole(req),
      token: extractResetToken(req),
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword,
    });

    return sendResponse(res, 200, true, result.message, {}, null);
  });

  return {
    forgotPassword,
    resetPassword,
  };
};

const unifiedPasswordResetController = {
  forgotPassword: asyncHandler(async (req, res) => {
    const result = await passwordResetService.forgotPassword({
      moduleKey: req.body.module,
      authRole: getOptionalAuthRole(req),
      identifier: req.body.identifier,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    });

    return sendResponse(res, 200, true, result.message, result.data || {}, null);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const result = await passwordResetService.resetPassword({
      moduleKey: req.body.module,
      authRole: getOptionalAuthRole(req),
      token: extractResetToken(req),
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword,
    });

    return sendResponse(res, 200, true, result.message, {}, null);
  }),
};

module.exports = {
  buildPasswordResetController,
  unifiedPasswordResetController,
};
