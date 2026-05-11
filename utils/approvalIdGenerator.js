const AppError = require("./AppError");

const getDigitsOnly = (value) => String(value || "").replace(/\D/g, "");

const generateNameAbbreviation = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    throw new AppError("Name is required for ID generation", 400);
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const extractLastTwoDigits = (value, fieldName) => {
  const digits = getDigitsOnly(value);
  if (!digits.length) {
    throw new AppError(`${fieldName} must include numeric digits`, 400);
  }

  return digits.slice(-2).padStart(2, "0");
};

const extractYearLastTwoDigits = (value, fieldName) => {
  if (value === null || value === undefined || value === "") {
    throw new AppError(`${fieldName} is required for ID generation`, 400);
  }

  const parsedDate = new Date(value);
  const sourceYear = Number.isNaN(parsedDate.getTime()) ? Number(value) : parsedDate.getFullYear();
  if (!Number.isFinite(sourceYear)) {
    throw new AppError(`${fieldName} is invalid`, 400);
  }

  return String(Math.trunc(sourceYear)).slice(-2).padStart(2, "0");
};

const extractYearFull = (value, fieldName) => {
  if (value === null || value === undefined || value === "") {
    throw new AppError(`${fieldName} is required for ID generation`, 400);
  }

  const parsedDate = new Date(value);
  const sourceYear = Number.isNaN(parsedDate.getTime()) ? Number(value) : parsedDate.getFullYear();
  if (!Number.isFinite(sourceYear)) {
    throw new AppError(`${fieldName} is invalid`, 400);
  }

  return String(Math.trunc(sourceYear));
};

const generatePatientId = ({ name, dob, phone }) => {
  const nameAbbreviation = generateNameAbbreviation(name);
  const birthYear = extractYearLastTwoDigits(dob, "dob");
  const phoneSuffix = extractLastTwoDigits(phone, "phone");
  return `${nameAbbreviation}-${birthYear}-${phoneSuffix}`;
};

const generateDoctorId = ({ name, registrationYear, phone }) => {
  const nameAbbreviation = generateNameAbbreviation(name);
  const yearSuffix = extractYearLastTwoDigits(registrationYear, "registrationYear");
  const phoneSuffix = extractLastTwoDigits(phone, "phone");
  return `${nameAbbreviation}-${yearSuffix}-${phoneSuffix}`;
};

const generateHospitalId = ({ name, registrationYear, phone }) => {
  const normalizedName = String(name || "").replace(/\s+/g, "").toUpperCase();
  if (!normalizedName) {
    throw new AppError("Hospital name is required for ID generation", 400);
  }

  const year = extractYearFull(registrationYear, "registrationYear");
  const phoneSuffix = extractLastTwoDigits(phone, "phone");
  return `${normalizedName}-${year}-${phoneSuffix}`;
};

const generateRandomTwoDigits = () => String(Math.floor(Math.random() * 100)).padStart(2, "0");

const ensureUniqueGeneratedId = async ({ model, baseId, maxAttempts = 50 }) => {
  if (!baseId) {
    throw new AppError("baseId is required to ensure uniqueness", 500);
  }

  let candidate = String(baseId).toUpperCase();
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Keep generated IDs unique in the target collection.
    const exists = await model.exists({ generatedId: candidate });
    if (!exists) {
      return candidate;
    }

    candidate = `${String(baseId).toUpperCase()}-${generateRandomTwoDigits()}`;
    attempts += 1;
  }

  throw new AppError("Failed to generate unique ID after multiple attempts", 500);
};

module.exports = {
  generateNameAbbreviation,
  extractLastTwoDigits,
  extractYearLastTwoDigits,
  generatePatientId,
  generateDoctorId,
  generateHospitalId,
  ensureUniqueGeneratedId,
};
