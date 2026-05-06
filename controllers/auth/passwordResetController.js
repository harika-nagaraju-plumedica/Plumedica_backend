const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const passwordResetService = require("../../services/passwordResetService");

const buildPasswordResetController = (moduleKey) => {
  const forgotPassword = asyncHandler(async (req, res) => {
    const result = await passwordResetService.forgotPassword({
      moduleKey,
      identifier: req.body.identifier,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    });

    return sendResponse(res, 200, true, result.message, {}, null);
  });

  const resetPassword = asyncHandler(async (req, res) => {
    const result = await passwordResetService.resetPassword({
      moduleKey,
      token: req.body.token,
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

module.exports = {
  buildPasswordResetController,
};
