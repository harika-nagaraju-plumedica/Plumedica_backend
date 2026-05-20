const express = require("express");
const {
  registerDiagnosticsCenter,
  getDiagnostics,
} = require("../../controllers/diagnostics/diagnosticsController");

const router = express.Router();

router.get("/", getDiagnostics);
router.post("/", registerDiagnosticsCenter);

module.exports = router;
