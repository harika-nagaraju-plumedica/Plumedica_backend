const AppError = require("../utils/AppError");

const adminOnly = (req, res, next) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const role = String(req.user.role || "").trim().toLowerCase();
  if (!["admin", "superadmin", "super_admin"].includes(role)) {
    throw new AppError("Forbidden: admin access required", 403);
  }

  return next();
};

module.exports = adminOnly;