const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { MODULE_ALIASES, normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const isLoginDebugEnabled = process.env.AUTH_LOGIN_DEBUG === "true";

const sanitizeProfile = (doc) => {
  const profile = doc.toObject();
  delete profile.password;
  return profile;
};

const registerUser = asyncHandler(async (req, res) => {
  const requiredFields = ["name", "email", "password"];
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

  const user = await User.create({
    name: req.body.name,
    email: normalizedEmail,
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

const loginUser = asyncHandler(async (req, res) => {
  const requiredFields = ["email", "password"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const normalizedEmail = normalizeEmail(req.body.email);
  const password = req.body.password;
  const requestedModule = req.body.module
    ? MODULE_ALIASES[String(req.body.module).toLowerCase()]
    : null;

  if (req.body.module && !requestedModule) {
    throw new AppError("Invalid module value", 400);
  }

  const matches = await findMatchesByEmail(normalizedEmail, requestedModule);

  if (!matches.length) {
    if (isLoginDebugEnabled) {
      return sendResponse(res, 401, false, "Email not found", {
        debug: {
          emailChecked: normalizedEmail,
          emailFound: false,
          moduleFound: null,
          passwordMatched: false,
        },
      });
    }

    throw new AppError("Email not found", 401);
  }

  if (matches.length > 1) {
    throw new AppError("Multiple accounts found for this email. Please provide module in request body.", 409);
  }

  const authenticated = matches[0];
  const storedPassword = authenticated.profile.password || "";
  let isPasswordValid = await bcrypt.compare(password, storedPassword);

  // Backward compatibility for legacy records that may have stored plain text passwords.
  if (!isPasswordValid && storedPassword === password) {
    isPasswordValid = true;
    authenticated.profile.password = await bcrypt.hash(password, 10);
    await authenticated.profile.save();
  }

  if (!isPasswordValid) {
    if (isLoginDebugEnabled) {
      return sendResponse(res, 401, false, "Incorrect password", {
        debug: {
          emailChecked: normalizedEmail,
          emailFound: true,
          moduleFound: authenticated.key,
          passwordMatched: false,
        },
      });
    }

    throw new AppError("Incorrect password", 401);
  }

  const token = generateToken({
    id: authenticated.profile._id,
    role: authenticated.role,
    email: authenticated.profile.email,
  });

  return sendResponse(res, 200, true, "Login successful", {
    module: authenticated.key,
    profile: sanitizeProfile(authenticated.profile),
    token,
  });
});

module.exports = {
  registerUser,
  loginUser,
};
