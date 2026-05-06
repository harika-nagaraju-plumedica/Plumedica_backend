const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { generateToken } = require("../utils/token");
const { validateRequiredFields } = require("../utils/validation");

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
    nameFields: ["fullName"],
    emailFields: ["email"],
    cityFields: ["clinicAddress"],
  },
  hospitals: {
    model: Hospital,
    nameFields: ["hospitalName"],
    emailFields: ["email"],
    cityFields: ["city"],
  },
  pharmacies: {
    model: Pharmacy,
    nameFields: ["legalPharmacyName"],
    emailFields: ["email"],
    cityFields: ["city"],
  },
  insurance: {
    model: PartnerOrganization,
    nameFields: ["organizationName"],
    emailFields: ["email"],
    cityFields: [],
  },
  patients: {
    model: Patient,
    nameFields: ["fullName"],
    emailFields: ["email"],
    cityFields: ["address"],
  },
  jobseekers: {
    model: JobSeeker,
    nameFields: ["fullName"],
    emailFields: ["email"],
    cityFields: [],
  },
  employers: {
    model: Employer,
    nameFields: ["companyName"],
    emailFields: ["email"],
    cityFields: [],
  },
};

const REGULATED_ENTITY_KEYS = ["doctors", "hospitals", "pharmacies", "insurance"];
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid id format", 400);
  }

  return id;
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
  const id = parseObjectIdParam(req.params.id);

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
    throw new AppError("Approval allowed only for doctors, hospitals, pharmacies, and insurance", 400);
  }

  const config = getEntityConfig(entity);
  const id = parseObjectIdParam(req.params.id);
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

  return sendResponse(res, 200, true, "Entity approved successfully", {
    item: sanitizeDoc(record),
  });
});

const rejectEntity = asyncHandler(async (req, res) => {
  const entity = String(req.params.entity || "").toLowerCase();
  if (!REGULATED_ENTITY_KEYS.includes(entity)) {
    throw new AppError("Approval allowed only for doctors, hospitals, pharmacies, and insurance", 400);
  }

  const rejectionReason = String(req.body.rejectionReason || "").trim();
  if (!rejectionReason) {
    throw new AppError("rejectionReason is required", 400);
  }

  const config = getEntityConfig(entity);
  const id = parseObjectIdParam(req.params.id);
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