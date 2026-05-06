const bcrypt = require("bcryptjs");
const Pharmacy = require("../../models/Pharmacy");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const normalizePath = (filePath) => (filePath ? filePath.replace(/\\/g, "/") : null);

const registerPharmacy = asyncHandler(async (req, res) => {
  const requiredFields = [
    "legalPharmacyName",
    "email",
    "password",
    "state",
    "city",
    "phoneNumber",
    "gstNumber",
  ];

  const missingFields = validateRequiredFields(req.body, requiredFields);
  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const gstCertificateFile = req.files?.gstCertificate?.[0];
  if (!gstCertificateFile) {
    throw new AppError("gstCertificate file is required", 400);
  }

  const normalizedEmail = normalizeEmail(req.body.email);
  const existingAccounts = await findMatchesByEmail(normalizedEmail);
  if (existingAccounts.length) {
    throw new AppError("Account already exists with this email", 409);
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  const pharmacy = await Pharmacy.create({
    ...req.body,
    email: normalizedEmail,
    password: hashedPassword,
    hasDrugLicense: req.body.hasDrugLicense === "true" || req.body.hasDrugLicense === true,
    gstCertificate: normalizePath(gstCertificateFile.path),
    drugLicense: normalizePath(req.files?.drugLicense?.[0]?.path),
  });

  const pharmacyData = pharmacy.toObject();
  delete pharmacyData.password;

  const token = generateToken({
    id: pharmacy._id,
    role: "pharmacy",
    email: pharmacy.email,
    tokenVersion: Number(pharmacy.tokenVersion || 0),
  });

  return sendResponse(res, 201, true, "Pharmacy registered successfully", {
    profile: pharmacyData,
    token,
  });
});

module.exports = {
  registerPharmacy,
};
