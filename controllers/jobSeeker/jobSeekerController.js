const JobSeeker = require("../../models/JobSeeker");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");

const registerJobSeeker = asyncHandler(async (req, res) => {
  const requiredFields = ["fullName", "email", "phone", "experience"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const jobSeeker = await JobSeeker.create(req.body);
  return sendResponse(res, 201, true, "Job seeker registered successfully", jobSeeker);
});

module.exports = {
  registerJobSeeker,
};
