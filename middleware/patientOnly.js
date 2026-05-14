const AppError = require("../utils/AppError");

const patientOnly = (req, res, next) => {
  const role = String(req.user?.role || "").trim().toLowerCase();
  if (role !== "patient") {
    throw new AppError("Forbidden: patient access required", 403, "FORBIDDEN_PATIENT_ONLY");
  }

  return next();
};

module.exports = patientOnly;
