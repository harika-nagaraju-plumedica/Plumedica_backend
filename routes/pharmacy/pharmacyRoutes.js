const express = require("express");
const upload = require("../../middleware/upload");
const {
  registerPharmacy,
} = require("../../controllers/pharmacy/pharmacyController");

const router = express.Router();

const pharmacyUpload = upload.fields([
  { name: "gstCertificate", maxCount: 1 },
  { name: "drugLicense", maxCount: 1 },
]);

router.post("/", pharmacyUpload, registerPharmacy);

module.exports = router;
