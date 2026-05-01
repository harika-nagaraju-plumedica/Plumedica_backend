const Hospital = require("../../models/Hospital");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");

const normalizePath = (filePath) => (filePath ? filePath.replace(/\\/g, "/") : null);

const registerHospital = asyncHandler(async (req, res) => {
  const requiredFields = [
    "hospitalName",
    "state",
    "city",
    "gstNumber",
    "ceRegistrationNumber",
    "email",
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

  const hospital = await Hospital.create({
    ...req.body,
    gstCertificate: normalizePath(gstCertificateFile.path),
    ceLicense: normalizePath(ceLicenseFile.path),
  });

  const token = generateToken({
    id: hospital._id,
    role: "hospital",
    email: hospital.email,
  });

  return sendResponse(res, 201, true, "Hospital registered successfully", {
    profile: hospital,
    token,
  });
});

module.exports = {
  registerHospital,
};
