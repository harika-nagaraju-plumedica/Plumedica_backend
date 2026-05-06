const express = require("express");
const {
  loginAdmin,
  getDashboard,
  listEntities,
  getEntityDetails,
  approveEntity,
  rejectEntity,
} = require("../controllers/adminController");
const { buildPasswordResetController } = require("../controllers/auth/passwordResetController");
const forgotPasswordRateLimitValidation = require("../middleware/forgotPasswordRateLimit");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();
const adminPasswordResetController = buildPasswordResetController("admin");

router.post("/login", loginAdmin);
router.post("/forgot-password", forgotPasswordRateLimitValidation, adminPasswordResetController.forgotPassword);
router.post("/reset-password", adminPasswordResetController.resetPassword);

router.use(auth, adminOnly);

router.get("/dashboard", getDashboard);
router.get("/:entity", listEntities);
router.get("/:entity/:id", getEntityDetails);
router.put("/:entity/:id/approve", approveEntity);
router.put("/:entity/:id/reject", rejectEntity);

module.exports = router;