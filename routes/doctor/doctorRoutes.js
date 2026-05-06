const express = require("express");
const upload = require("../../middleware/upload");
const {
  registerDoctor,
} = require("../../controllers/doctor/doctorController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const doctorPasswordResetController = buildPasswordResetController("doctor");

router.post("/", upload.single("medicalLicenseDocument"), registerDoctor);
router.post("/forgot-password", forgotPasswordRateLimitValidation, doctorPasswordResetController.forgotPassword);
router.post("/reset-password", doctorPasswordResetController.resetPassword);

module.exports = router;
