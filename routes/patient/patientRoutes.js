const express = require("express");
const {
  registerPatient,
} = require("../../controllers/patient/patientController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const patientPasswordResetController = buildPasswordResetController("patient");

router.post("/", registerPatient);
router.post("/forgot-password", forgotPasswordRateLimitValidation, patientPasswordResetController.forgotPassword);
router.post("/reset-password", patientPasswordResetController.resetPassword);

module.exports = router;
