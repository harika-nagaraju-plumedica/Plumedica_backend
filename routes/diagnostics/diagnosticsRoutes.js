const express = require("express");
const {
  registerDiagnosticsCenter,
  getAllDiagnostics,
} = require("../../controllers/diagnostics/diagnosticsController");

const router = express.Router();

router.get("/", getAllDiagnostics);
router.post("/", registerDiagnosticsCenter);

module.exports = router;
