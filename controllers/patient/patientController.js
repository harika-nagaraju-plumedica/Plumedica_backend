const bcrypt = require("bcryptjs");
const Patient = require("../../models/Patient");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const registerPatient = asyncHandler(async (req, res) => {
  const requiredFields = ["fullName", "email", "password", "mobile", "gender", "bloodGroup", "address"];
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

  const patient = await Patient.create({
    ...req.body,
    email: normalizedEmail,
    password: hashedPassword,
  });

  const patientData = patient.toObject();
  delete patientData.password;

  const token = generateToken({
    id: patient._id,
    role: "patient",
    email: patient.email,
    tokenVersion: Number(patient.tokenVersion || 0),
  });

  return sendResponse(res, 201, true, "Patient registered successfully", {
    profile: patientData,
    token,
  });
});

module.exports = {
  registerPatient,
};
