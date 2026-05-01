const bcrypt = require("bcryptjs");
const Doctor = require("../../models/Doctor");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");

const normalizePath = (filePath) => (filePath ? filePath.replace(/\\/g, "/") : null);

const parseAvailabilitySlots = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new AppError("availabilitySlots must be a valid JSON array", 400);
    }
  }

  return [];
};

const registerDoctor = asyncHandler(async (req, res) => {
  const requiredFields = [
    "fullName",
    "email",
    "mobileNumber",
    "password",
    "qualification",
    "yearOfGraduation",
    "yearsOfExperience",
    "clinicAddress",
    "medicalLicenseNumber",
  ];

  const missingFields = validateRequiredFields(req.body, requiredFields);
  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const availabilitySlots = parseAvailabilitySlots(req.body.availabilitySlots);
  if (!availabilitySlots.length) {
    throw new AppError("availabilitySlots is required and must have at least one day", 400);
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  const doctor = await Doctor.create({
    ...req.body,
    password: hashedPassword,
    availabilitySlots,
    medicalLicenseDocument: normalizePath(req.file?.path),
  });

  return sendResponse(res, 201, true, "Doctor registered successfully", doctor);
});

module.exports = {
  registerDoctor,
};
