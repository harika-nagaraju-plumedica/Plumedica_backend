const AppError = require("./AppError");

const getDigitsOnly = (value) => String(value || "").replace(/\D/g, "");

const generateNameAbbreviation = (name) => {
  const cleaned = String(name || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (!cleaned) {
    throw new AppError("Name is required for ID generation", 400);
  }

  return cleaned.slice(0, 2).padEnd(2, "X");
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
  return `${nameAbbreviation}${birthYear}${phoneSuffix}`;
};

const generateDoctorId = ({ name, registrationYear, phone }) => {
  const nameAbbreviation = generateNameAbbreviation(name);
  const yearSuffix = extractYearLastTwoDigits(registrationYear, "registrationYear");
  const phoneSuffix = extractLastTwoDigits(phone, "phone");
  return `${nameAbbreviation}${yearSuffix}${phoneSuffix}`;
};

const generateHospitalId = ({ name, registrationYear, phone }) => {
  const nameAbbreviation = generateNameAbbreviation(name);
  const year = extractYearFull(registrationYear, "registrationYear");
  const phoneSuffix = extractLastTwoDigits(phone, "phone");
  return `${nameAbbreviation}${year}${phoneSuffix}`;
};

const generateId = (user, type) => {
  const payload = user && typeof user === "object" ? user : {};
  const normalizedType = String(type || "").trim().toLowerCase();

  if (normalizedType === "patient") {
    return generatePatientId({
      name: payload.name,
      dob: payload.dob,
      phone: payload.mobile || payload.phone,
    });
  }

  if (normalizedType === "doctor") {
    return generateDoctorId({
      name: payload.name,
      registrationYear: payload.registrationYear,
      phone: payload.mobile || payload.phone,
    });
  }

  if (normalizedType === "hospital") {
    return generateHospitalId({
      name: payload.name,
      registrationYear: payload.registrationYear,
      phone: payload.mobile || payload.phone,
    });
  }

  throw new AppError("Invalid type for ID generation", 400);
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
  generateId,
  generateNameAbbreviation,
  extractLastTwoDigits,
  extractYearLastTwoDigits,
  generatePatientId,
  generateDoctorId,
  generateHospitalId,
  ensureUniqueGeneratedId,
};
