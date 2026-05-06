const express = require("express");
const {
  registerDiagnosticsCenter,
} = require("../../controllers/diagnostics/diagnosticsController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const diagnosticsPasswordResetController = buildPasswordResetController("diagnostics-center");

router.post("/", registerDiagnosticsCenter);
router.post("/forgot-password", forgotPasswordRateLimitValidation, diagnosticsPasswordResetController.forgotPassword);
router.post("/reset-password", diagnosticsPasswordResetController.resetPassword);

module.exports = router;
