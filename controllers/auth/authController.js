const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");

const registerUser = asyncHandler(async (req, res) => {
  const requiredFields = ["name", "email", "password"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
  if (existingUser) {
    throw new AppError("User already exists with this email", 409);
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: hashedPassword,
    phone: req.body.phone,
  });

  const userData = user.toObject();
  delete userData.password;

  const token = generateToken({
    id: user._id,
    role: "user",
    email: user.email,
  });

  return sendResponse(res, 201, true, "User registered successfully", {
    profile: userData,
    token,
  });
});

module.exports = {
  registerUser,
};
