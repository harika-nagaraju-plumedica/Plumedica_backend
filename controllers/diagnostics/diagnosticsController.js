const bcrypt = require("bcryptjs");
const DiagnosticsCenter = require("../../models/DiagnosticsCenter");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { validateRequiredFields } = require("../../utils/validation");

const registerDiagnosticsCenter = asyncHandler(async (req, res) => {
  const requiredFields = ["centerName", "email", "password"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const diagnosticsCenter = await DiagnosticsCenter.create({
    ...req.body,
    password: hashedPassword,
  });

  return sendResponse(res, 201, true, "Diagnostics center registered successfully", diagnosticsCenter);
});

module.exports = {
  registerDiagnosticsCenter,
};
