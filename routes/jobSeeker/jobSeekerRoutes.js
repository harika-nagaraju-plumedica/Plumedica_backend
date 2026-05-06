const express = require("express");
const {
  registerJobSeeker,
} = require("../../controllers/jobSeeker/jobSeekerController");
const { buildPasswordResetController } = require("../../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../../middleware/forgotPasswordRateLimit");

const router = express.Router();
const jobSeekerPasswordResetController = buildPasswordResetController("job-seeker");

router.post("/", registerJobSeeker);
router.post("/forgot-password", forgotPasswordRateLimitValidation, jobSeekerPasswordResetController.forgotPassword);
router.post("/reset-password", jobSeekerPasswordResetController.resetPassword);

module.exports = router;
