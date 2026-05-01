const PartnerOrganization = require("../../models/PartnerOrganization");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");

const registerPartnerOrganization = asyncHandler(async (req, res) => {
  const requiredFields = ["organizationName", "email", "mobile", "licenseNumber"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const partnerOrganization = await PartnerOrganization.create(req.body);

  const token = generateToken({
    id: partnerOrganization._id,
    role: "partner-organization",
    email: partnerOrganization.email,
  });

  return sendResponse(res, 201, true, "Partner organization registered successfully", {
    profile: partnerOrganization,
    token,
  });
});

module.exports = {
  registerPartnerOrganization,
};
