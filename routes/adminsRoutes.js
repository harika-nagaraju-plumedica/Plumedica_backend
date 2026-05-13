const express = require("express");
const auth = require("../middleware/auth");
const superAdminOnly = require("../middleware/superAdmin");
const {
  createAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
} = require("../controllers/adminController");

const router = express.Router();

router.use(auth, superAdminOnly);

router.post("/", createAdmin);
router.get("/", listAdmins);
router.put("/:id", updateAdmin);
router.delete("/:id", deleteAdmin);

module.exports = router;
