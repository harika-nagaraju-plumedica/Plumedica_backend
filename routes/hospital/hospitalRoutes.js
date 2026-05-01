const express = require("express");
const upload = require("../../middleware/upload");
const {
  registerHospital,
} = require("../../controllers/hospital/hospitalController");

const router = express.Router();

const hospitalUpload = upload.fields([
  { name: "gstCertificate", maxCount: 1 },
  { name: "ceLicense", maxCount: 1 },
]);

router.post("/", hospitalUpload, registerHospital);

module.exports = router;
