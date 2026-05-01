const Patient = require("../../models/Patient");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");

const registerPatient = asyncHandler(async (req, res) => {
  const requiredFields = ["fullName", "email", "mobile", "gender", "bloodGroup", "address"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const patient = await Patient.create(req.body);

  const token = generateToken({
    id: patient._id,
    role: "patient",
    email: patient.email,
  });

  return sendResponse(res, 201, true, "Patient registered successfully", {
    profile: patient,
    token,
  });
});

module.exports = {
  registerPatient,
};
