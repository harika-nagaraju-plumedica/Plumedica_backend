const AppError = require("../utils/AppError");

const adminOnly = (req, res, next) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  if (!["admin", "superadmin"].includes(req.user.role)) {
    throw new AppError("Forbidden: admin access required", 403);
  }

  return next();
};

module.exports = adminOnly;