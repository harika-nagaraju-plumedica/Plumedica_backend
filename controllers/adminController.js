const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { generateToken } = require("../utils/token");
const { validateRequiredFields } = require("../utils/validation");
const { sendEntityStatusNotification } = require("../services/entityStatusNotificationService");

const Admin = require("../models/Admin");
const Doctor = require("../models/Doctor");
const Hospital = require("../models/Hospital");
const Pharmacy = require("../models/Pharmacy");
const PartnerOrganization = require("../models/PartnerOrganization");
const Patient = require("../models/Patient");
const JobSeeker = require("../models/JobSeeker");
const Employer = require("../models/Employer");

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
    throw new AppError("Invalid admin entity", 400);
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
  const candidates = [req.params.id, req.body.id, req.body._id, req.query.id, req.query._id]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const lowered = value.toLowerCase();
      return lowered !== "undefined" && lowered !== "null";
    });

  const validObjectId = candidates.find((value) => mongoose.Types.ObjectId.isValid(value));
  return validObjectId || candidates[0] || "";
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

  const rejectionReason = String(req.body.rejectionReason || "").trim();
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

module.exports = {
  loginAdmin,
  getDashboard,
  listEntities,
  getEntityDetails,
  approveEntity,
  rejectEntity,
};