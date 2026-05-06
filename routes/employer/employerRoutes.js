const express = require("express");
const {
  registerEmployer,
} = require("../../controllers/employer/employerController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const employerPasswordResetController = buildPasswordResetController("employer");

router.post("/", registerEmployer);
router.post("/forgot-password", forgotPasswordRateLimitValidation, employerPasswordResetController.forgotPassword);
router.post("/reset-password", employerPasswordResetController.resetPassword);

module.exports = router;
