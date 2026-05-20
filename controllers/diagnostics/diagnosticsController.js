const bcrypt = require("bcryptjs");
const Diagnostics = require("../../models/Diagnostics");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");
const { generateToken } = require("../../utils/token");
const { normalizeEmail, findMatchesByEmail } = require("../../utils/authModules");

const registerDiagnosticsCenter = asyncHandler(async (req, res) => {
  const requiredFields = ["centerName", "email", "password"];
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
  const diagnosticsCenter = await Diagnostics.create({
    ...req.body,
    email: normalizedEmail,
    password: hashedPassword,
    status: "Pending",
  });

  const diagnosticsData = diagnosticsCenter.toObject();
  delete diagnosticsData.password;

  const token = generateToken({
    id: diagnosticsCenter._id,
    role: "diagnostics-center",
    email: diagnosticsCenter.email,
    tokenVersion: Number(diagnosticsCenter.tokenVersion || 0),
  });

  return sendResponse(res, 201, true, "Diagnostics center registered successfully", {
    profile: diagnosticsData,
    token,
  });
});

const getDiagnostics = async (req, res) => {
  try {
    const { search, fromDate, toDate } = req.query || {};
    const filter = {};

    if (search) {
      filter.centerName = { $regex: String(search).trim(), $options: "i" };
    }

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);

      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        filter.createdAt = {
          $gte: from,
          $lte: to,
        };
      }
    }

    const data = await Diagnostics.find(filter).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  registerDiagnosticsCenter,
  getDiagnostics,
  getAllDiagnostics: getDiagnostics,
};
