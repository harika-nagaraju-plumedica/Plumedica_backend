const AppError = require("../utils/AppError");

const superAdminOnly = (req, res, next) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const role = String(req.user.role || "").trim().toLowerCase();
  if (role !== "superadmin" && role !== "super_admin") {
    throw new AppError("Forbidden: SUPER_ADMIN access required", 403, "FORBIDDEN_SUPER_ADMIN_ONLY");
  }

  return next();
};

module.exports = superAdminOnly;
