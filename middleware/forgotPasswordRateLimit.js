const AppError = require("../utils/AppError");
const { normalizeIdentifier, isValidEmail, isValidPhone } = require("../utils/passwordResetValidation");

const forgotPasswordRateLimitValidation = (req, res, next) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  if (!identifier) {
    throw new AppError("identifier is required", 400, "MISSING_IDENTIFIER");
  }

  if (!isValidEmail(identifier) && !isValidPhone(identifier)) {
    throw new AppError("identifier must be a valid email or E.164 phone", 400, "INVALID_IDENTIFIER_FORMAT");
  }

  return next();
};

module.exports = forgotPasswordRateLimitValidation;
