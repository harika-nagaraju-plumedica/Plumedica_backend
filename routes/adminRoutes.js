const express = require("express");
const {
  loginAdmin,
  getDashboard,
  listEntities,
  getEntityDetails,
  approveEntity,
  rejectEntity,
  approveUserById,
  debugEmailDelivery,
} = require("../controllers/adminController");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

router.post("/login", loginAdmin);

router.use(auth, adminOnly);

router.get("/dashboard", getDashboard);
router.post("/approve-user/:id", approveUserById);
router.post("/email-delivery-debug", debugEmailDelivery);
router.get("/:entity", listEntities);
router.get("/:entity/:id", getEntityDetails);
router.put("/:entity/approve", approveEntity);
router.put("/:entity/reject", rejectEntity);
router.put("/:entity/:id/approve", approveEntity);
router.put("/:entity/:id/reject", rejectEntity);

module.exports = router;