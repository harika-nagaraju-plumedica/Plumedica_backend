const bcrypt = require("bcryptjs");
const JobSeeker = require("../../models/JobSeeker");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const registerJobSeeker = asyncHandler(async (req, res) => {
  const requiredFields = ["fullName", "email", "password", "phone", "experience"];
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

  const jobSeeker = await JobSeeker.create({
    ...req.body,
    email: normalizedEmail,
    password: hashedPassword,
  });

  const jobSeekerData = jobSeeker.toObject();
  delete jobSeekerData.password;

  const token = generateToken({
    id: jobSeeker._id,
    role: "job-seeker",
    email: jobSeeker.email,
  });

  return sendResponse(res, 201, true, "Job seeker registered successfully", {
    profile: jobSeekerData,
    token,
  });
});

module.exports = {
  registerJobSeeker,
};
