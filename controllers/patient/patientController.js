const Patient = require("../../models/Patient");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");

const registerPatient = asyncHandler(async (req, res) => {
  const requiredFields = ["fullName", "email", "mobile", "gender", "bloodGroup", "address"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const patient = await Patient.create(req.body);
  return sendResponse(res, 201, true, "Patient registered successfully", patient);
});

module.exports = {
  registerPatient,
};
