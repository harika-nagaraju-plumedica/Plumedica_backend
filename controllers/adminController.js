const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { generateToken } = require("../utils/token");
const { validateRequiredFields } = require("../utils/validation");
const {
  sendEntityStatusNotification,
  debugEntityStatusEmailDelivery,
} = require("../services/entityStatusNotificationService");
const {
  generatePatientId,
  generateDoctorId,
  generateHospitalId,
  ensureUniqueGeneratedId,
} = require("../utils/approvalIdGenerator");
const { sendApprovalIdEmail } = require("../services/approvalIdEmailService");

const Admin = require("../models/Admin");
const Doctor = require("../models/Doctor");
const Hospital = require("../models/Hospital");
const Pharmacy = require("../models/Pharmacy");
const PartnerOrganization = require("../models/PartnerOrganization");
const Patient = require("../models/Patient");
const JobSeeker = require("../models/JobSeeker");
const Employer = require("../models/Employer");
const ApprovalUser = require("../models/ApprovalUser");

const ENTITY_CONFIG = {
  doctors: {
    model: Doctor,
    entityLabel: "doctor registration",
    nameFields: ["fullName"],
    emailFields: ["email"],
    cityFields: ["clinicAddress"],
    approvalNextSteps: "Log in to complete your doctor profile and set your availability.",
  },
  hospitals: {
    model: Hospital,
    entityLabel: "hospital registration",
    nameFields: ["hospitalName"],
    emailFields: ["email"],
    cityFields: ["city"],
    approvalNextSteps: "Log in to update hospital details and start managing your account.",
  },
  pharmacies: {
    model: Pharmacy,
    entityLabel: "pharmacy registration",
    nameFields: ["legalPharmacyName"],
    emailFields: ["email"],
    cityFields: ["city"],
    approvalNextSteps: "Log in to update your pharmacy catalog and business profile.",
  },
  insurance: {
    model: PartnerOrganization,
    entityLabel: "insurance partner registration",
    nameFields: ["organizationName"],
    emailFields: ["email"],
    cityFields: [],
    approvalNextSteps: "Log in to complete your organization setup and partnership details.",
  },
  patients: {
    model: Patient,
    entityLabel: "patient registration",
    nameFields: ["fullName"],
    emailFields: ["email"],
    cityFields: ["address"],
    approvalNextSteps: "Log in to complete your profile and explore available services.",
  },
  jobseekers: {
    model: JobSeeker,
    entityLabel: "job seeker registration",
    nameFields: ["fullName"],
    emailFields: ["email"],
    cityFields: [],
    approvalNextSteps: "Log in to update your profile and start applying for jobs.",
  },
  employers: {
    model: Employer,
    entityLabel: "employer registration",
    nameFields: ["companyName"],
    emailFields: ["email"],
    cityFields: [],
    approvalNextSteps: "Log in to create job listings and manage applicants.",
  },
};

const REGULATED_ENTITY_KEYS = ["doctors", "hospitals", "pharmacies", "insurance", "employers"];
const ALLOWED_STATUSES = ["Pending", "Approved", "Rejected"];

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const escapeRegex = (value = "") => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const normalizeStatus = (status) => {
  if (!status) {
    return null;
  }

  const lowered = String(status).trim().toLowerCase();
  if (lowered === "pending") {
    return "Pending";
  }

  if (lowered === "approved") {
    return "Approved";
  }

  if (lowered === "rejected") {
    return "Rejected";
  }

  return null;
};

const getEntityConfig = (entityKey) => {
  const config = ENTITY_CONFIG[entityKey];
  if (!config) {
    throw new AppError("Invalid or missing fields", 400, "VALIDATION_FAILED");
  }

  return config;
};

const pickFirstDefinedValue = (record, fields = []) => {
  for (const field of fields) {
    const value = String(record?.[field] || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
};

const notifyEntityStatusChange = async ({ entityKey, record, config, status, rejectionReason }) => {
  const recipientEmail = pickFirstDefinedValue(record, config.emailFields);
  if (!recipientEmail) {
    console.error("[admin-approval] status updated but no email found", {
      entityLabel: config.entityLabel,
      recordId: String(record?._id || ""),
      status,
    });
    return;
  }

  const recipientName = pickFirstDefinedValue(record, config.nameFields) || "User";

  try {
    await sendEntityStatusNotification({
      entityKey,
      recordId: record?._id,
      to: recipientEmail,
      recipientName,
      entityLabel: config.entityLabel,
      status,
      rejectionReason,
      nextSteps: status === "Approved" ? config.approvalNextSteps : "",
    });
  } catch (error) {
    console.error("[admin-approval] failed to send status notification", {
      entityLabel: config.entityLabel,
      recordId: String(record?._id || ""),
      status,
      recipientEmail,
      error: error?.message || error,
    });
  }
};

const buildSearchQuery = (searchValue, fields) => {
  if (!searchValue) {
    return null;
  }

  const term = String(searchValue).trim();
  if (!term) {
    return null;
  }

  const safeTerm = escapeRegex(term);

  return {
    $or: fields.map((field) => ({
      [field]: { $regex: safeTerm, $options: "i" },
    })),
  };
};

const sanitizeDoc = (doc) => {
  const entity = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  if (entity && entity._id && !entity.id) {
    entity.id = String(entity._id);
  }
  delete entity.password;
  return entity;
};

const ADMIN_PERMISSION_ENUM = [
  "HOSPITALS",
  "DOCTORS",
  "PHARMACIES",
  "PATIENTS",
  "INSURANCE",
  "JOB_SEEKERS",
  "EMPLOYERS",
  "DASHBOARD",
  "APPROVALS",
  "REPORTS",
  "SETTINGS",
];

const sendAdminValidationFailed = (res) => {
  return res.status(400).json({
    error: "VALIDATION_FAILED",
    message: "Invalid or missing fields",
  });
};

const normalizeAdminPermissions = (permissions) => {
  if (!Array.isArray(permissions)) {
    return null;
  }

  const normalized = permissions
    .map((permission) => String(permission || "").trim().toUpperCase())
    .filter(Boolean);

  if (!normalized.length) {
    return [];
  }

  const unique = [...new Set(normalized)];
  const hasInvalid = unique.some((permission) => !ADMIN_PERMISSION_ENUM.includes(permission));
  if (hasInvalid) {
    return null;
  }

  return unique;
};

const toApiAdminRole = (roleValue = "") => {
  const normalized = String(roleValue).trim().toLowerCase();
  if (normalized === "superadmin" || normalized === "super_admin") {
    return "SUPER_ADMIN";
  }

  return "ADMIN";
};

const toAdminPayload = (admin) => {
  const profile = sanitizeDoc(admin);
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: toApiAdminRole(profile.role),
    permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
    status: profile.status || "ACTIVE",
  };
};

const getPagination = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const parseObjectIdParam = (idValue) => {
  const id = String(idValue || "").trim();
  if (!id || id.toLowerCase() === "undefined" || id.toLowerCase() === "null") {
    throw new AppError("id is required", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid id format", 400);
  }

  return id;
};

const resolveEntityId = (req) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = req.query && typeof req.query === "object" ? req.query : {};

  const candidates = [req.params.id, body.id, body._id, query.id, query._id]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const lowered = value.toLowerCase();
      return lowered !== "undefined" && lowered !== "null";
    });

  const validObjectId = candidates.find((value) => mongoose.Types.ObjectId.isValid(value));
  return validObjectId || candidates[0] || "";
};

const getApprovalCandidateById = async (id) => {
  const [patient, doctor, hospital] = await Promise.all([
    Patient.findById(id),
    Doctor.findById(id),
    Hospital.findById(id),
  ]);

  if (patient) {
    return {
      role: "patient",
      model: Patient,
      doc: patient,
      name: patient.fullName,
      phone: patient.mobile,
      email: patient.email,
      dob: patient.dob,
      registrationYear: null,
    };
  }

  if (doctor) {
    const fallbackYear = doctor.createdAt instanceof Date ? doctor.createdAt.getFullYear() : null;
    return {
      role: "doctor",
      model: Doctor,
      doc: doctor,
      name: doctor.fullName,
      phone: doctor.mobileNumber,
      email: doctor.email,
      dob: null,
      registrationYear: doctor.registrationYear || doctor.yearOfGraduation || fallbackYear,
    };
  }

  if (hospital) {
    const fallbackYear = hospital.createdAt instanceof Date ? hospital.createdAt.getFullYear() : null;
    return {
      role: "hospital",
      model: Hospital,
      doc: hospital,
      name: hospital.hospitalName,
      phone: hospital.mobile,
      email: hospital.email,
      dob: null,
      registrationYear: hospital.registrationYear || fallbackYear,
    };
  }

  return null;
};

const buildGeneratedId = (candidate) => {
  if (candidate.role === "patient") {
    return generatePatientId({
      name: candidate.name,
      dob: candidate.dob,
      phone: candidate.phone,
    });
  }

  if (candidate.role === "doctor") {
    return generateDoctorId({
      name: candidate.name,
      registrationYear: candidate.registrationYear,
      phone: candidate.phone,
    });
  }

  return generateHospitalId({
    name: candidate.name,
    registrationYear: candidate.registrationYear,
    phone: candidate.phone,
  });
};

const loginAdmin = asyncHandler(async (req, res) => {
  const requiredFields = ["email", "password"];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const email = String(req.body.email).trim().toLowerCase();
  const password = String(req.body.password);

  const admin = await Admin.findOne({ email });
  if (!admin) {
    throw new AppError("Invalid email or password", 401);
  }

  let isPasswordValid = false;
  const storedPassword = String(admin.password || "");

  if (BCRYPT_HASH_REGEX.test(storedPassword)) {
    isPasswordValid = await bcrypt.compare(password, storedPassword);
  } else if (storedPassword === password) {
    isPasswordValid = true;

    // Auto-migrate legacy plain-text passwords to bcrypt hash after successful login.
    admin.password = await bcrypt.hash(password, 10);
    await admin.save();
  }

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = generateToken({
    id: admin._id,
    role: admin.role,
    email: admin.email,
    tokenVersion: Number(admin.tokenVersion || 0),
  });

  const profile = admin.toObject();
  delete profile.password;

  return sendResponse(res, 200, true, "Admin login successful", {
    token,
    profile,
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalDoctors,
    totalHospitals,
    totalPharmacies,
    totalInsurance,
    totalPatients,
    totalJobSeekers,
    totalEmployers,
    pendingDoctors,
    pendingHospitals,
    pendingPharmacies,
    pendingInsurance,
    approvedDoctors,
    approvedHospitals,
    approvedPharmacies,
    approvedInsurance,
    rejectedDoctors,
    rejectedHospitals,
    rejectedPharmacies,
    rejectedInsurance,
  ] = await Promise.all([
    Doctor.countDocuments(),
    Hospital.countDocuments(),
    Pharmacy.countDocuments(),
    PartnerOrganization.countDocuments(),
    Patient.countDocuments(),
    JobSeeker.countDocuments(),
    Employer.countDocuments(),
    Doctor.countDocuments({ status: "Pending" }),
    Hospital.countDocuments({ status: "Pending" }),
    Pharmacy.countDocuments({ status: "Pending" }),
    PartnerOrganization.countDocuments({ status: "Pending" }),
    Doctor.countDocuments({ status: "Approved" }),
    Hospital.countDocuments({ status: "Approved" }),
    Pharmacy.countDocuments({ status: "Approved" }),
    PartnerOrganization.countDocuments({ status: "Approved" }),
    Doctor.countDocuments({ status: "Rejected" }),
    Hospital.countDocuments({ status: "Rejected" }),
    Pharmacy.countDocuments({ status: "Rejected" }),
    PartnerOrganization.countDocuments({ status: "Rejected" }),
  ]);

  return sendResponse(res, 200, true, "Dashboard data fetched successfully", {
    totals: {
      doctors: totalDoctors,
      hospitals: totalHospitals,
      pharmacies: totalPharmacies,
      insurance: totalInsurance,
      patients: totalPatients,
      jobSeekers: totalJobSeekers,
      employers: totalEmployers,
    },
    approvalPipeline: {
      pending: pendingDoctors + pendingHospitals + pendingPharmacies + pendingInsurance,
      approved: approvedDoctors + approvedHospitals + approvedPharmacies + approvedInsurance,
      rejected: rejectedDoctors + rejectedHospitals + rejectedPharmacies + rejectedInsurance,
    },
  });
});

const listEntities = asyncHandler(async (req, res) => {
  const entity = String(req.params.entity || "").toLowerCase();
  const config = getEntityConfig(entity);

  const status = normalizeStatus(req.query.status);
  if (req.query.status && !status) {
    throw new AppError(`Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`, 400);
  }

  const searchableFields = [...config.nameFields, ...config.emailFields, ...config.cityFields];
  const searchQuery = buildSearchQuery(req.query.search, searchableFields);

  const query = {};
  if (status) {
    query.status = status;
  }
  if (searchQuery) {
    Object.assign(query, searchQuery);
  }

  const { page, limit, skip } = getPagination(req);

  const [total, records] = await Promise.all([
    config.model.countDocuments(query),
    config.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return sendResponse(res, 200, true, "Data fetched successfully", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    items: records.map(sanitizeDoc),
  });
});

const getEntityDetails = asyncHandler(async (req, res) => {
  const entity = String(req.params.entity || "").toLowerCase();
  const config = getEntityConfig(entity);
  const id = parseObjectIdParam(resolveEntityId(req));

  const record = await config.model.findById(id).lean();
  if (!record) {
    throw new AppError("Record not found", 404);
  }

  return sendResponse(res, 200, true, "Data fetched successfully", {
    item: sanitizeDoc(record),
  });
});

const approveEntity = asyncHandler(async (req, res) => {
  const entity = String(req.params.entity || "").toLowerCase();
  if (!REGULATED_ENTITY_KEYS.includes(entity)) {
    throw new AppError("Approval allowed only for doctors, hospitals, pharmacies, insurance, and employers", 400);
  }

  const config = getEntityConfig(entity);
  const id = parseObjectIdParam(resolveEntityId(req));
  const record = await config.model.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "Approved",
        rejectionReason: "",
      },
    },
    { new: true }
  );

  if (!record) {
    throw new AppError("Record not found", 404);
  }

  await notifyEntityStatusChange({
    entityKey: entity,
    record,
    config,
    status: "Approved",
  });

  return sendResponse(res, 200, true, "Entity approved successfully", {
    item: sanitizeDoc(record),
  });
});

const rejectEntity = asyncHandler(async (req, res) => {
  const entity = String(req.params.entity || "").toLowerCase();
  if (!REGULATED_ENTITY_KEYS.includes(entity)) {
    throw new AppError("Approval allowed only for doctors, hospitals, pharmacies, insurance, and employers", 400);
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const rejectionReason = String(body.rejectionReason || "").trim();
  if (!rejectionReason) {
    throw new AppError("rejectionReason is required", 400);
  }

  const config = getEntityConfig(entity);
  const id = parseObjectIdParam(resolveEntityId(req));
  const record = await config.model.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "Rejected",
        rejectionReason,
      },
    },
    { new: true }
  );

  if (!record) {
    throw new AppError("Record not found", 404);
  }

  await notifyEntityStatusChange({
    entityKey: entity,
    record,
    config,
    status: "Rejected",
    rejectionReason,
  });

  return sendResponse(res, 200, true, "Entity rejected successfully", {
    item: sanitizeDoc(record),
  });
});

const approveUserById = asyncHandler(async (req, res) => {
  const id = parseObjectIdParam(req.params.id);
  const candidate = await getApprovalCandidateById(id);

  if (!candidate) {
    throw new AppError("User not found for approval", 404);
  }

  const generatedId = String(candidate.doc.generatedId || "").trim()
    ? String(candidate.doc.generatedId).trim().toUpperCase()
    : await ensureUniqueGeneratedId({
        model: candidate.model,
        baseId: buildGeneratedId(candidate),
      });

  candidate.doc.generatedId = generatedId;
  candidate.doc.status = "Approved";
  if (Object.prototype.hasOwnProperty.call(candidate.doc.toObject(), "rejectionReason")) {
    candidate.doc.rejectionReason = "";
  }
  await candidate.doc.save();

  const approvalSnapshot = await ApprovalUser.findOneAndUpdate(
    { role: candidate.role, email: candidate.email },
    {
      $set: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        dob: candidate.dob || null,
        registrationYear: candidate.registrationYear || null,
        role: candidate.role,
        generatedId,
        status: "approved",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  try {
    await sendApprovalIdEmail({
      to: candidate.email,
      recipientName: candidate.name,
      role: candidate.role,
      generatedId,
    });
  } catch (error) {
    console.error("[approve-user] failed to send generated id email", {
      role: candidate.role,
      recordId: String(candidate.doc._id || ""),
      email: candidate.email,
      error: error?.message || error,
    });
  }

  return sendResponse(res, 200, true, "User approved successfully", {
    item: sanitizeDoc(candidate.doc),
    approvalRecord: approvalSnapshot,
  });
});

const debugEmailDelivery = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const to = String(body.to || "").trim();
  const result = await debugEntityStatusEmailDelivery({ to });

  return sendResponse(
    res,
    200,
    result.ok,
    result.ok ? "Email diagnostics completed" : "Email diagnostics failed",
    {
      diagnostics: result,
    },
    result.ok ? null : "EMAIL_DIAGNOSTICS_FAILED"
  );
});

const createAdmin = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "").trim();
  const permissions = normalizeAdminPermissions(body.permissions);

  if (!name || !email || !password || role !== "ADMIN" || password.length < 6 || permissions === null) {
    return sendAdminValidationFailed(res);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendAdminValidationFailed(res);
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    throw new AppError("email already exists", 409, "DUPLICATE_VALUE");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await Admin.create({
    name,
    email,
    password: passwordHash,
    role: "admin",
    permissions,
    status: "ACTIVE",
  });

  return sendResponse(res, 201, true, "Admin created successfully", toAdminPayload(created));
});

const listAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find({ role: { $in: ["admin", "ADMIN"] } })
    .sort({ createdAt: -1 })
    .lean();

  return sendResponse(res, 200, true, "Admins fetched successfully", {
    items: admins.map((admin) => toAdminPayload(admin)),
  });
});

const updateAdmin = asyncHandler(async (req, res) => {
  const id = parseObjectIdParam(req.params.id);

  const admin = await Admin.findById(id);
  if (!admin) {
    throw new AppError("Admin not found", 404, "ADMIN_NOT_FOUND");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const update = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = String(body.name || "").trim();
    if (!name) {
      return sendAdminValidationFailed(res);
    }
    update.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "permissions")) {
    const permissions = normalizeAdminPermissions(body.permissions);
    if (permissions === null) {
      return sendAdminValidationFailed(res);
    }
    update.permissions = permissions;
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = String(body.status || "").trim().toUpperCase();
    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return sendAdminValidationFailed(res);
    }
    update.status = status;
  }

  if (!Object.keys(update).length) {
    return sendAdminValidationFailed(res);
  }

  Object.assign(admin, update);
  await admin.save();

  return sendResponse(res, 200, true, "Admin updated successfully", toAdminPayload(admin));
});

const deleteAdmin = asyncHandler(async (req, res) => {
  const id = parseObjectIdParam(req.params.id);

  const admin = await Admin.findById(id);
  if (!admin) {
    throw new AppError("Admin not found", 404, "ADMIN_NOT_FOUND");
  }

  const role = String(admin.role || "").toLowerCase();
  if (role === "superadmin" || role === "super_admin") {
    throw new AppError("Cannot delete SUPER_ADMIN", 400, "SUPER_ADMIN_PROTECTED");
  }

  await Admin.deleteOne({ _id: admin._id });

  return sendResponse(res, 200, true, "Admin deleted successfully", {
    id: String(admin._id),
  });
});

module.exports = {
  loginAdmin,
  getDashboard,
  listEntities,
  getEntityDetails,
  approveEntity,
  rejectEntity,
  approveUserById,
  debugEmailDelivery,
  createAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
};