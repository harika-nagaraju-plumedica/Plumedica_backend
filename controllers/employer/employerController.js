const bcrypt = require("bcryptjs");
const Employer = require("../../models/Employer");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const registerEmployer = asyncHandler(async (req, res) => {
  const requiredFields = ["companyName", "email", "password"];
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

  const employer = await Employer.create({
    ...req.body,
    email: normalizedEmail,
    password: hashedPassword,
  });

  const employerData = employer.toObject();
  delete employerData.password;

  const token = generateToken({
    id: employer._id,
    role: "employer",
    email: employer.email,
    tokenVersion: Number(employer.tokenVersion || 0),
  });

  return sendResponse(res, 201, true, "Employer registered successfully", {
    profile: employerData,
    token,
  });
});

module.exports = {
  registerEmployer,
};
