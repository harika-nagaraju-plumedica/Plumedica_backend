const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { generateToken } = require("../utils/token");
const { validateRequiredFields } = require("../utils/validation");
const {
  generatePatientId,
  generateUserId,
  ensureUniqueGeneratedId,
} = require("../utils/approvalIdGenerator");
const { sendStatusEmail } = require("../services/emailService");

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
const COMMON_ID_ENTITY_KEYS = ["doctors", "hospitals", "pharmacies", "employers"];
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
  const [patient, doctor, hospital, pharmacy, employer] = await Promise.all([
    Patient.findById(id),
    Doctor.findById(id),
    Hospital.findById(id),
    Pharmacy.findById(id),
    Employer.findById(id),
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

  if (pharmacy) {
    const fallbackYear = pharmacy.createdAt instanceof Date ? pharmacy.createdAt.getFullYear() : null;
    return {
      role: "pharmacy",
      model: Pharmacy,
      doc: pharmacy,
      name: pharmacy.legalPharmacyName,
      phone: pharmacy.phoneNumber,
      email: pharmacy.email,
      dob: null,
      registrationYear: pharmacy.registrationYear || fallbackYear,
    };
  }

  if (employer) {
    const fallbackYear = employer.createdAt instanceof Date ? employer.createdAt.getFullYear() : null;
    return {
      role: "employer",
      model: Employer,
      doc: employer,
      name: employer.companyName,
      phone: employer.mobile || employer.phoneNumber || employer.phone,
      email: employer.email,
      dob: null,
      registrationYear: employer.registrationYear || fallbackYear,
    };
  }

  return null;
};

const buildCommonIdCandidateFromEntity = (entity, record) => {
  if (entity === "doctors") {
    const fallbackYear = record.createdAt instanceof Date ? record.createdAt.getFullYear() : null;
    return {
      name: record.fullName,
      mobile: record.mobileNumber,
      registrationYear: record.registrationYear || record.yearOfGraduation || fallbackYear,
    };
  }

  if (entity === "hospitals") {
    const fallbackYear = record.createdAt instanceof Date ? record.createdAt.getFullYear() : null;
    return {
      name: record.hospitalName,
      mobile: record.mobile,
      registrationYear: record.registrationYear || fallbackYear,
    };
  }

  if (entity === "pharmacies") {
    const fallbackYear = record.createdAt instanceof Date ? record.createdAt.getFullYear() : null;
    return {
      name: record.legalPharmacyName,
      mobile: record.phoneNumber,
      registrationYear: record.registrationYear || fallbackYear,
    };
  }

  if (entity === "employers") {
    const fallbackYear = record.createdAt instanceof Date ? record.createdAt.getFullYear() : null;
    return {
      name: record.companyName,
      mobile: record.mobile || record.phoneNumber || record.phone,
      registrationYear: record.registrationYear || fallbackYear,
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

  if (["doctor", "hospital", "pharmacy", "employer"].includes(candidate.role)) {
    return generateUserId({
      name: candidate.name,
      registrationYear: candidate.registrationYear,
      mobile: candidate.phone,
    });
  }

  throw new AppError("Unsupported role for ID generation", 400);
};

const validateCommonIdFields = ({ name, registrationYear, mobile }) => {
  if (!String(name || "").trim()) {
    throw new AppError("name is required for ID generation", 400);
  }

  if (registrationYear === null || registrationYear === undefined || registrationYear === "") {
    throw new AppError("registrationYear is required for ID generation", 400);
  }

  if (!String(mobile || "").trim()) {
    throw new AppError("mobile or phone is required for ID generation", 400);
  }
};

const generateCommonApprovalId = ({ name, registrationYear, mobile, createdAt }) => {
  validateCommonIdFields({ name, registrationYear, mobile });

  console.log("Name:", name);
  console.log("Year:", registrationYear);
  console.log("Mobile:", mobile);

  const generatedId = generateUserId({
    name,
    registrationYear,
    mobile,
    createdAt,
  });

  console.log("Generated ID:", generatedId);

  return String(generatedId).trim().toUpperCase();
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

  const existingRecord = await config.model.findById(id);
  if (!existingRecord) {
    throw new AppError("Record not found", 404);
  }

  const updatePayload = {
    status: "Approved",
    rejectionReason: "",
  };

  if (COMMON_ID_ENTITY_KEYS.includes(entity)) {
    const existingGeneratedId = String(existingRecord.generatedId || "").trim().toUpperCase();
    if (existingGeneratedId) {
      updatePayload.generatedId = existingGeneratedId;
    } else {
      const idCandidate = buildCommonIdCandidateFromEntity(entity, existingRecord);
      const generatedId = generateCommonApprovalId({
        name: idCandidate?.name,
        registrationYear: idCandidate?.registrationYear,
        mobile: idCandidate?.mobile,
        createdAt: existingRecord.createdAt,
      });
      const duplicateGeneratedId = await config.model.exists({
        generatedId,
        _id: { $ne: existingRecord._id },
      });
      if (duplicateGeneratedId) {
        throw new AppError("Generated ID already exists for another record", 409);
      }
      updatePayload.generatedId = generatedId;
    }
  }

  const record = await config.model.findByIdAndUpdate(
    id,
    {
      $set: updatePayload,
    },
    { new: true }
  );

  if (!record) {
    throw new AppError("Record not found", 404);
  }

  const requestBody = req.body && typeof req.body === "object" ? req.body : {};
  const loginLink = String(
    process.env.APP_LOGIN_URL || process.env.FRONTEND_LOGIN_URL || "https://plumedica.com/login"
  ).trim();
  const persistedPassword = String(record.password || "").trim();
  const approvalPassword = String(requestBody.password || "").trim();
  const emailPayload = {
    name: pickFirstDefinedValue(record, config.nameFields) || "User",
    email: pickFirstDefinedValue(record, config.emailFields),
    generatedId: String(record.generatedId || "").trim(),
    password: approvalPassword || (BCRYPT_HASH_REGEX.test(persistedPassword) ? "" : persistedPassword),
    loginLink,
  };

  const emailResult = await sendStatusEmail(emailPayload, "Approved");
  const approvalEmail = {
    attempted: true,
    delivered: Boolean(emailResult?.delivered),
    provider: String(emailResult?.provider || "sendgrid"),
    reason: String(emailResult?.reason || ""),
    recipientEmail: String(emailPayload.email || "").trim(),
  };

  if (!approvalEmail.delivered) {
    console.error("[approve-entity] approval email not delivered", {
      entity,
      recordId: String(record._id || ""),
      email: approvalEmail.recipientEmail,
      reason: approvalEmail.reason || "EMAIL_NOT_DELIVERED",
    });
  }

  return sendResponse(res, 200, true, "Entity approved successfully", {
    item: sanitizeDoc(record),
    approvalEmail,
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

  const emailPayload = {
    name: pickFirstDefinedValue(record, config.nameFields) || "User",
    email: pickFirstDefinedValue(record, config.emailFields),
    generatedId: String(record.generatedId || "").trim(),
    password: "",
  };

  const emailResult = await sendStatusEmail(emailPayload, "Rejected", rejectionReason);
  const rejectionEmail = {
    attempted: true,
    delivered: Boolean(emailResult?.delivered),
    provider: String(emailResult?.provider || "sendgrid"),
    reason: String(emailResult?.reason || ""),
    recipientEmail: String(emailPayload.email || "").trim(),
  };

  if (!rejectionEmail.delivered) {
    console.error("[reject-entity] rejection email not delivered", {
      entity,
      recordId: String(record._id || ""),
      email: rejectionEmail.recipientEmail,
      reason: rejectionEmail.reason || "EMAIL_NOT_DELIVERED",
    });
  }

  return sendResponse(res, 200, true, "Entity rejected successfully", {
    item: sanitizeDoc(record),
    rejectionEmail,
  });
});

const approveUserById = asyncHandler(async (req, res) => {
  const id = parseObjectIdParam(req.params.id);
  const candidate = await getApprovalCandidateById(id);

  if (!candidate) {
    throw new AppError("User not found for approval", 404);
  }

  let generatedId = String(candidate.doc.generatedId || "").trim().toUpperCase();
  if (!generatedId) {
    if (["doctor", "hospital", "pharmacy", "employer"].includes(candidate.role)) {
      generatedId = generateCommonApprovalId({
        name: candidate.name,
        registrationYear: candidate.registrationYear,
        mobile: candidate.phone,
        createdAt: candidate.doc.createdAt,
      });

      const duplicateGeneratedId = await candidate.model.exists({
        generatedId,
        _id: { $ne: candidate.doc._id },
      });
      if (duplicateGeneratedId) {
        throw new AppError("Generated ID already exists for another record", 409);
      }
    } else {
      generatedId = await ensureUniqueGeneratedId({
        model: candidate.model,
        baseId: buildGeneratedId(candidate),
      });
    }
  }

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

  const requestBody = req.body && typeof req.body === "object" ? req.body : {};
  const requestPassword = String(requestBody.password || "").trim();
  const persistedPassword = String(candidate.doc.password || "").trim();
  const approvalPassword = requestPassword || (BCRYPT_HASH_REGEX.test(persistedPassword) ? "" : persistedPassword);
  const loginLink = String(
    process.env.APP_LOGIN_URL || process.env.FRONTEND_LOGIN_URL || "https://plumedica.com/login"
  ).trim();

  let approvalEmail = {
    attempted: true,
    delivered: false,
    reason: "NOT_ATTEMPTED",
    recipientEmail: candidate.email,
  };

  try {
    const emailResult = await sendStatusEmail(
      {
      name: candidate.name,
      email: candidate.email,
      generatedId,
      password: approvalPassword,
      loginLink,
      },
      "Approved"
    );

    approvalEmail = {
      attempted: true,
      delivered: Boolean(emailResult?.delivered),
      provider: String(emailResult?.provider || "sendgrid"),
      reason: String(emailResult?.reason || ""),
      recipientEmail: candidate.email,
    };

    if (!approvalEmail.delivered) {
      console.error("[approve-user] approval email not delivered", {
        role: candidate.role,
        recordId: String(candidate.doc._id || ""),
        email: candidate.email,
        reason: approvalEmail.reason || "EMAIL_NOT_DELIVERED",
      });
    }
  } catch (error) {
    console.error("[approve-user] failed to send approval email", {
      role: candidate.role,
      recordId: String(candidate.doc._id || ""),
      email: candidate.email,
      error: error?.message || error,
    });

    approvalEmail = {
      attempted: true,
      delivered: false,
      reason: String(error?.message || "EMAIL_DELIVERY_ERROR"),
      recipientEmail: candidate.email,
    };
  }

  return sendResponse(res, 200, true, "User approved successfully", {
    item: sanitizeDoc(candidate.doc),
    approvalRecord: approvalSnapshot,
    approvalEmail,
  });
});

const updateStatus = asyncHandler(async (req, res) => {
  const id = parseObjectIdParam(req.params.id);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const nextStatus = normalizeStatus(body.status);
  const reason = String(body.reason || body.rejectionReason || "").trim();

  if (!nextStatus || (nextStatus !== "Approved" && nextStatus !== "Rejected")) {
    throw new AppError("status must be either Approved or Rejected", 400);
  }

  const candidate = await getApprovalCandidateById(id);
  if (!candidate) {
    throw new AppError("User not found", 404);
  }

  const updatePayload = {
    status: nextStatus,
  };

  if (Object.prototype.hasOwnProperty.call(candidate.doc.toObject(), "rejectionReason")) {
    updatePayload.rejectionReason = nextStatus === "Rejected" ? reason : "";
  }

  if (nextStatus === "Approved") {
    const existingGeneratedId = String(candidate.doc.generatedId || "").trim().toUpperCase();
    if (existingGeneratedId) {
      updatePayload.generatedId = existingGeneratedId;
    } else if (["doctor", "hospital", "pharmacy", "employer"].includes(candidate.role)) {
      const generatedId = generateCommonApprovalId({
        name: candidate.name,
        registrationYear: candidate.registrationYear,
        mobile: candidate.phone,
        createdAt: candidate.doc.createdAt,
      });

      const duplicateGeneratedId = await candidate.model.exists({
        generatedId,
        _id: { $ne: candidate.doc._id },
      });
      if (duplicateGeneratedId) {
        throw new AppError("Generated ID already exists for another record", 409);
      }

      updatePayload.generatedId = generatedId;
    } else {
      updatePayload.generatedId = await ensureUniqueGeneratedId({
        model: candidate.model,
        baseId: buildGeneratedId(candidate),
      });
    }
  }

  const updatedUser = await candidate.model.findByIdAndUpdate(
    id,
    { $set: updatePayload },
    { new: true }
  );

  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  const requestPassword = String(body.password || "").trim();
  const persistedPassword = String(updatedUser.password || "").trim();
  const emailPassword = requestPassword || (BCRYPT_HASH_REGEX.test(persistedPassword) ? "" : persistedPassword);

  const emailPayload = {
    name: candidate.name || updatedUser.fullName || updatedUser.hospitalName || "User",
    email: candidate.email || updatedUser.email,
    generatedId: String(updatedUser.generatedId || "").trim(),
    password: emailPassword,
    loginLink: String(
      process.env.APP_LOGIN_URL || process.env.FRONTEND_LOGIN_URL || "https://plumedica.com/login"
    ).trim(),
  };

  const emailResult = await sendStatusEmail(emailPayload, nextStatus, reason);
  if (emailResult?.delivered) {
    console.info("[admin-update-status] status updated and email sent", {
      userId: String(updatedUser._id || ""),
      role: candidate.role,
      status: nextStatus,
      recipientEmail: emailPayload.email,
    });
  } else {
    console.error("[admin-update-status] status updated but email failed", {
      userId: String(updatedUser._id || ""),
      role: candidate.role,
      status: nextStatus,
      recipientEmail: emailPayload.email,
      reason: String(emailResult?.reason || "EMAIL_NOT_DELIVERED"),
    });
  }

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
        generatedId: String(updatedUser.generatedId || "").trim().toUpperCase(),
        status: nextStatus.toLowerCase(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return sendResponse(res, 200, true, "Status updated successfully", {
    item: sanitizeDoc(updatedUser),
    approvalRecord: approvalSnapshot,
    approvalEmail: {
      attempted: true,
      delivered: Boolean(emailResult?.delivered),
      provider: String(emailResult?.provider || "sendgrid"),
      reason: String(emailResult?.reason || ""),
      recipientEmail: String(emailPayload.email || "").trim(),
    },
  });
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
  updateStatus,
  createAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
};