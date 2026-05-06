const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Pharmacy = require("../models/Pharmacy");
const Patient = require("../models/Patient");
const Hospital = require("../models/Hospital");
const DiagnosticsCenter = require("../models/DiagnosticsCenter");
const PartnerOrganization = require("../models/PartnerOrganization");
const JobSeeker = require("../models/JobSeeker");
const Employer = require("../models/Employer");

const PASSWORD_RESET_MODULES = {
  admin: {
    role: "admin",
    model: Admin,
    emailField: "email",
    phoneFields: [],
    routeBase: "/api/admin",
  },
  user: {
    role: "user",
    model: User,
    emailField: "email",
    phoneFields: ["phone"],
    routeBase: "/api/auth",
  },
  doctor: {
    role: "doctor",
    model: Doctor,
    emailField: "email",
    phoneFields: ["mobileNumber"],
    routeBase: "/api/doctors",
  },
  pharmacy: {
    role: "pharmacy",
    model: Pharmacy,
    emailField: "email",
    phoneFields: ["phoneNumber"],
    routeBase: "/api/pharmacies",
  },
  patient: {
    role: "patient",
    model: Patient,
    emailField: "email",
    phoneFields: ["mobile"],
    routeBase: "/api/patients",
  },
  hospital: {
    role: "hospital",
    model: Hospital,
    emailField: "email",
    phoneFields: ["mobile"],
    routeBase: "/api/hospitals",
  },
  "diagnostics-center": {
    role: "diagnostics-center",
    model: DiagnosticsCenter,
    emailField: "email",
    phoneFields: [],
    routeBase: "/api/diagnostics-centers",
  },
  "partner-organization": {
    role: "partner-organization",
    model: PartnerOrganization,
    emailField: "email",
    phoneFields: ["mobile"],
    routeBase: "/api/partner-organizations",
  },
  "job-seeker": {
    role: "job-seeker",
    model: JobSeeker,
    emailField: "email",
    phoneFields: ["phone"],
    routeBase: "/api/job-seekers",
  },
  employer: {
    role: "employer",
    model: Employer,
    emailField: "email",
    phoneFields: [],
    routeBase: "/api/employers",
  },
};

const MODULE_ALIASES = {
  admin: "admin",
  user: "user",
  doctor: "doctor",
  pharmacy: "pharmacy",
  patient: "patient",
  hospital: "hospital",
  diagnostics: "diagnostics-center",
  "diagnostics-center": "diagnostics-center",
  diagnosticscenter: "diagnostics-center",
  partner: "partner-organization",
  "partner-organization": "partner-organization",
  partnerorganization: "partner-organization",
  "job-seeker": "job-seeker",
  jobseeker: "job-seeker",
  employer: "employer",
};

const normalizeModuleKey = (moduleKey = "") => MODULE_ALIASES[String(moduleKey).trim().toLowerCase()] || null;

const getModuleConfig = (moduleKey = "") => PASSWORD_RESET_MODULES[normalizeModuleKey(moduleKey)] || null;

const getModelByRole = (role = "") => {
  const normalizedRole = String(role).trim().toLowerCase();
  return Object.values(PASSWORD_RESET_MODULES).find((moduleConfig) => moduleConfig.role === normalizedRole)?.model || null;
};

const findByIdentifier = async (moduleKey, identifier, isEmail) => {
  const moduleConfig = getModuleConfig(moduleKey);
  if (!moduleConfig) {
    return null;
  }

  const { model, emailField, phoneFields } = moduleConfig;

  if (isEmail) {
    return model.findOne({ [emailField]: String(identifier).trim().toLowerCase() });
  }

  if (!phoneFields.length) {
    return null;
  }

  const normalizedPhone = String(identifier).trim();
  const query = {
    $or: phoneFields.map((phoneField) => ({
      [phoneField]: normalizedPhone,
    })),
  };

  return model.findOne(query);
};

const parseObjectId = (value = "") => {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    return null;
  }

  return new mongoose.Types.ObjectId(String(value));
};

module.exports = {
  PASSWORD_RESET_MODULES,
  MODULE_ALIASES,
  normalizeModuleKey,
  getModuleConfig,
  getModelByRole,
  findByIdentifier,
  parseObjectId,
};
