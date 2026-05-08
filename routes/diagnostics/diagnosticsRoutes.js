const express = require("express");
const {
  registerDiagnosticsCenter,
} = require("../../controllers/diagnostics/diagnosticsController");

const router = express.Router();

router.post("/", registerDiagnosticsCenter);

module.exports = router;
