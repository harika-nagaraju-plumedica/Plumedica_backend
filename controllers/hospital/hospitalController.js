const bcrypt = require("bcryptjs");
const Hospital = require("../../models/Hospital");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const normalizePath = (filePath) => (filePath ? filePath.replace(/\\/g, "/") : null);

const registerHospital = asyncHandler(async (req, res) => {
  const requiredFields = [
    "hospitalName",
    "state",
    "city",
    "gstNumber",
    "ceRegistrationNumber",
    "email",
    "password",
    "mobile",
    "address",
  ];

  const missingFields = validateRequiredFields(req.body, requiredFields);
  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const gstCertificateFile = req.files?.gstCertificate?.[0];
  const ceLicenseFile = req.files?.ceLicense?.[0];

  if (!gstCertificateFile || !ceLicenseFile) {
    throw new AppError("gstCertificate and ceLicense files are required", 400);
  }

  const normalizedEmail = normalizeEmail(req.body.email);
  const existingAccounts = await findMatchesByEmail(normalizedEmail);
  if (existingAccounts.length) {
    throw new AppError("Account already exists with this email", 409);
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  const hospital = await Hospital.create({
    ...req.body,
    email: normalizedEmail,
    password: hashedPassword,
    gstCertificate: normalizePath(gstCertificateFile.path),
    ceLicense: normalizePath(ceLicenseFile.path),
  });

  const hospitalData = hospital.toObject();
  delete hospitalData.password;

  const token = generateToken({
    id: hospital._id,
    role: "hospital",
    email: hospital.email,
    tokenVersion: Number(hospital.tokenVersion || 0),
  });

  return sendResponse(res, 201, true, "Hospital registered successfully", {
    profile: hospitalData,
    token,
  });
});

module.exports = {
  registerHospital,
};
