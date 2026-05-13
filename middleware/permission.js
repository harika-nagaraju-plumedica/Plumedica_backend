const mongoose = require("mongoose");
const AppError = require("../utils/AppError");
const Admin = require("../models/Admin");

const ENTITY_PERMISSION_MAP = {
  doctors: "DOCTORS",
  hospitals: "HOSPITALS",
  pharmacies: "PHARMACIES",
  patients: "PATIENTS",
  insurance: "INSURANCE",
  jobseekers: "JOB_SEEKERS",
  employers: "EMPLOYERS",
};

const normalizeRole = (roleValue = "") => String(roleValue).trim().toLowerCase();

const getAdminFromRequest = async (req) => {
  const id = String(req.user?.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Unauthorized: invalid admin id", 401, "UNAUTHORIZED_INVALID_ADMIN_ID");
  }

  const admin = await Admin.findById(id).select("role status permissions tokenVersion");
  if (!admin) {
    throw new AppError("Unauthorized: admin not found", 401, "UNAUTHORIZED_ADMIN_NOT_FOUND");
  }

  const status = String(admin.status || "ACTIVE").trim().toUpperCase();
  if (status !== "ACTIVE") {
    throw new AppError("Forbidden: admin account inactive", 403, "FORBIDDEN_INACTIVE_ADMIN");
  }

  req.adminAccount = admin;
  return admin;
};

const requireAdminPermission = (permission) => {
  return async (req, res, next) => {
    const role = normalizeRole(req.user?.role);

    if (role === "superadmin" || role === "super_admin") {
      return next();
    }

    if (role !== "admin") {
      throw new AppError("Forbidden: admin access required", 403, "FORBIDDEN_ADMIN_ONLY");
    }

    const admin = await getAdminFromRequest(req);
    const permissions = Array.isArray(admin.permissions)
      ? admin.permissions.map((item) => String(item || "").trim().toUpperCase())
      : [];

    const required = String(permission || "").trim().toUpperCase();
    if (!required || !permissions.includes(required)) {
      throw new AppError("Forbidden: missing required permission", 403, "FORBIDDEN_MISSING_PERMISSION");
    }

    return next();
  };
};

const requireEntityPermission = () => {
  return async (req, res, next) => {
    const entity = String(req.params?.entity || "").trim().toLowerCase();
    const permission = ENTITY_PERMISSION_MAP[entity];

    if (!permission) {
      throw new AppError("Invalid or missing fields", 400, "VALIDATION_FAILED");
    }

    const middleware = requireAdminPermission(permission);
    return middleware(req, res, next);
  };
};

module.exports = {
  requireAdminPermission,
  requireEntityPermission,
};
