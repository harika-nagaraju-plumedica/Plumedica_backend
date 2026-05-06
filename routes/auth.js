const express = require("express");
const { registerUser, loginUser } = require("../controllers/auth/authController");
const { buildPasswordResetController } = require("../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../middleware/forgotPasswordRateLimit");

const router = express.Router();
const userPasswordResetController = buildPasswordResetController("user");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPasswordRateLimitValidation, userPasswordResetController.forgotPassword);
router.post("/reset-password", userPasswordResetController.resetPassword);

module.exports = router;
