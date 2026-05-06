const bcrypt = require("bcryptjs");
const PartnerOrganization = require("../../models/PartnerOrganization");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const registerPartnerOrganization = asyncHandler(async (req, res) => {
  const requiredFields = ["organizationName", "email", "password", "mobile", "licenseNumber"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const normalizedEmail = normalizeEmail(req.body.email);
  const existingAccounts = await findMatchesByEmail(normalizedEmail);
  if (existingAccounts.length) {
    throw new AppError("Account already exists with this email", 409);
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  const partnerOrganization = await PartnerOrganization.create({
    ...req.body,
    email: normalizedEmail,
    password: hashedPassword,
  });

  const partnerData = partnerOrganization.toObject();
  delete partnerData.password;

  const token = generateToken({
    id: partnerOrganization._id,
    role: "partner-organization",
    email: partnerOrganization.email,
    tokenVersion: Number(partnerOrganization.tokenVersion || 0),
  });

  return sendResponse(res, 201, true, "Partner organization registered successfully", {
    profile: partnerData,
    token,
  });
});

module.exports = {
  registerPartnerOrganization,
};
