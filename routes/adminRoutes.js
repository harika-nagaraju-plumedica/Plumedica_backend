const express = require("express");
const {
  loginAdmin,
  getDashboard,
  listEntities,
  getEntityDetails,
  approveEntity,
  rejectEntity,
} = require("../controllers/adminController");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const router = express.Router();

router.post("/login", loginAdmin);

router.use(auth, adminOnly);

router.get("/dashboard", getDashboard);
router.get("/:entity", listEntities);
router.get("/:entity/:id", getEntityDetails);
router.put("/:entity/:id/approve", approveEntity);
router.put("/:entity/:id/reject", rejectEntity);

module.exports = router;