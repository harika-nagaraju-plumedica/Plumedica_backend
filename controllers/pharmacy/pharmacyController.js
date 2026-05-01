const Pharmacy = require("../../models/Pharmacy");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");

const normalizePath = (filePath) => (filePath ? filePath.replace(/\\/g, "/") : null);

const registerPharmacy = asyncHandler(async (req, res) => {
  const requiredFields = [
    "legalPharmacyName",
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

  const pharmacy = await Pharmacy.create({
    ...req.body,
    hasDrugLicense: req.body.hasDrugLicense === "true" || req.body.hasDrugLicense === true,
    gstCertificate: normalizePath(gstCertificateFile.path),
    drugLicense: normalizePath(req.files?.drugLicense?.[0]?.path),
  });

  const token = generateToken({
    id: pharmacy._id,
    role: "pharmacy",
    email: pharmacy.email || null,
  });

  return sendResponse(res, 201, true, "Pharmacy registered successfully", {
    profile: pharmacy,
    token,
  });
});

module.exports = {
  registerPharmacy,
};
