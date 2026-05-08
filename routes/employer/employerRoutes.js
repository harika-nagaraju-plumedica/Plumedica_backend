const express = require("express");
const {
  registerEmployer,
} = require("../../controllers/employer/employerController");

const router = express.Router();

router.post("/", registerEmployer);

module.exports = router;
