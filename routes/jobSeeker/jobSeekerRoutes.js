const express = require("express");
const {
  registerJobSeeker,
} = require("../../controllers/jobSeeker/jobSeekerController");

const router = express.Router();

router.post("/", registerJobSeeker);

module.exports = router;
