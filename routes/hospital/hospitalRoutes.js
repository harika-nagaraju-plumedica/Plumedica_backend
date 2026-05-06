const express = require("express");
const upload = require("../../middleware/upload");
const {
  registerHospital,
} = require("../../controllers/hospital/hospitalController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const hospitalPasswordResetController = buildPasswordResetController("hospital");

const hospitalUpload = upload.fields([
  { name: "gstCertificate", maxCount: 1 },
  { name: "ceLicense", maxCount: 1 },
]);

router.post("/", hospitalUpload, registerHospital);
router.post("/forgot-password", forgotPasswordRateLimitValidation, hospitalPasswordResetController.forgotPassword);
router.post("/reset-password", hospitalPasswordResetController.resetPassword);

module.exports = router;
