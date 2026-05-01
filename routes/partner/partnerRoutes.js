const express = require("express");
const {
  registerPartnerOrganization,
} = require("../../controllers/partner/partnerController");

const router = express.Router();

router.post("/", registerPartnerOrganization);

module.exports = router;
