const express = require("express");
const {
  registerPartnerOrganization,
} = require("../../controllers/partner/partnerController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const partnerPasswordResetController = buildPasswordResetController("partner-organization");

router.post("/", registerPartnerOrganization);
router.post("/forgot-password", forgotPasswordRateLimitValidation, partnerPasswordResetController.forgotPassword);
router.post("/reset-password", partnerPasswordResetController.resetPassword);

module.exports = router;
