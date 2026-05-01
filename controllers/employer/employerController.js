const Employer = require("../../models/Employer");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");

const registerEmployer = asyncHandler(async (req, res) => {
  const requiredFields = ["companyName", "email"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const employer = await Employer.create(req.body);

  const token = generateToken({
    id: employer._id,
    role: "employer",
    email: employer.email,
  });

  return sendResponse(res, 201, true, "Employer registered successfully", {
    profile: employer,
    token,
  });
});

module.exports = {
  registerEmployer,
};
