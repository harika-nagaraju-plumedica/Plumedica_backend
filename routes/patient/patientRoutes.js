const express = require("express");
const {
  registerPatient,
} = require("../../controllers/patient/patientController");

const router = express.Router();

router.post("/", registerPatient);

module.exports = router;
