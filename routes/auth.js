const express = require("express");
const { registerUser, loginUser } = require("../controllers/auth/authController");
const { unifiedPasswordResetController } = require("../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../middleware/forgotPasswordRateLimit");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPasswordRateLimitValidation, unifiedPasswordResetController.forgotPassword);
router.post("/reset-password", unifiedPasswordResetController.resetPassword);
router.post("/reset-password/:token", unifiedPasswordResetController.resetPassword);

module.exports = router;
