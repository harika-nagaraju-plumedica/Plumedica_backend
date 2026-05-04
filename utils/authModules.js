const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Pharmacy = require("../models/Pharmacy");
const Patient = require("../models/Patient");
const Hospital = require("../models/Hospital");
const DiagnosticsCenter = require("../models/DiagnosticsCenter");
const PartnerOrganization = require("../models/PartnerOrganization");
const JobSeeker = require("../models/JobSeeker");
const Employer = require("../models/Employer");

const AUTH_MODELS = [
  { key: "user", role: "user", model: User },
  { key: "doctor", role: "doctor", model: Doctor },
  { key: "pharmacy", role: "pharmacy", model: Pharmacy },
  { key: "patient", role: "patient", model: Patient },
  { key: "hospital", role: "hospital", model: Hospital },
  { key: "diagnostics-center", role: "diagnostics-center", model: DiagnosticsCenter },
  { key: "partner-organization", role: "partner-organization", model: PartnerOrganization },
  { key: "job-seeker", role: "job-seeker", model: JobSeeker },
  { key: "employer", role: "employer", model: Employer },
];

const MODULE_ALIASES = {
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

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const findMatchesByEmail = async (email, moduleKey = null) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return [];
  }

  if (moduleKey) {
    const target = AUTH_MODELS.find((item) => item.key === moduleKey);
    if (!target) {
      return [];
    }

    const profile = await target.model.findOne({ email: normalizedEmail });
    return profile ? [{ ...target, profile }] : [];
  }

  const foundProfiles = await Promise.all(
    AUTH_MODELS.map(async (item) => {
      const profile = await item.model.findOne({ email: normalizedEmail });
      return profile ? { ...item, profile } : null;
    })
  );

  return foundProfiles.filter(Boolean);
};

module.exports = {
  AUTH_MODELS,
  MODULE_ALIASES,
  normalizeEmail,
  findMatchesByEmail,
};
