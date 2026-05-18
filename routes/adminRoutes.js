const express = require("express");
const {
  loginAdmin,
  getDashboard,
  listEntities,
  getEntityDetails,
  approveEntity,
  rejectEntity,
  approveUserById,
  updateStatus,
  debugEmailDelivery,
} = require("../controllers/adminController");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const { requireAdminPermission, requireEntityPermission } = require("../middleware/permission");

const router = express.Router();

router.post("/login", loginAdmin);

router.use(auth, adminOnly);

router.get("/dashboard", requireAdminPermission("DASHBOARD"), getDashboard);
router.post("/approve-user/:id", requireAdminPermission("APPROVALS"), approveUserById);
router.put("/update-status/:id", requireAdminPermission("APPROVALS"), updateStatus);
router.post("/email-delivery-debug", requireAdminPermission("SETTINGS"), debugEmailDelivery);
router.get("/:entity", requireEntityPermission(), listEntities);
router.get("/:entity/:id", requireEntityPermission(), getEntityDetails);
router.put("/:entity/approve", requireEntityPermission(), approveEntity);
router.put("/:entity/reject", requireEntityPermission(), rejectEntity);
router.put("/:entity/:id/approve", requireEntityPermission(), approveEntity);
router.put("/:entity/:id/reject", requireEntityPermission(), rejectEntity);

module.exports = router;