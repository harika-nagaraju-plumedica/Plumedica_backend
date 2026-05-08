const express = require("express");
const upload = require("../../middleware/upload");
const {
  registerDoctor,
} = require("../../controllers/doctor/doctorController");

const router = express.Router();

router.post("/", upload.single("medicalLicenseDocument"), registerDoctor);

module.exports = router;
