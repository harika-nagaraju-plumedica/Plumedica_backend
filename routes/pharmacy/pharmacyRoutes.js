const express = require("express");
const upload = require("../../middleware/upload");
const {
  registerPharmacy,
} = require("../../controllers/pharmacy/pharmacyController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const pharmacyPasswordResetController = buildPasswordResetController("pharmacy");

const pharmacyUpload = upload.fields([
  { name: "gstCertificate", maxCount: 1 },
  { name: "drugLicense", maxCount: 1 },
]);

router.post("/", pharmacyUpload, registerPharmacy);
router.post("/forgot-password", forgotPasswordRateLimitValidation, pharmacyPasswordResetController.forgotPassword);
router.post("/reset-password", pharmacyPasswordResetController.resetPassword);

module.exports = router;
