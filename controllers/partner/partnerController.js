const PartnerOrganization = require("../../models/PartnerOrganization");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");

const registerPartnerOrganization = asyncHandler(async (req, res) => {
  const requiredFields = ["organizationName", "email", "mobile", "licenseNumber"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const partnerOrganization = await PartnerOrganization.create(req.body);
  return sendResponse(res, 201, true, "Partner organization registered successfully", partnerOrganization);
});

module.exports = {
  registerPartnerOrganization,
};
