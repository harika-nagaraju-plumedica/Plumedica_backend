const AppError = require("./AppError");

const getDigitsOnly = (value) => String(value || "").replace(/\D/g, "");

const generateNameAbbreviation = (name) => {
  const cleaned = String(name || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (!cleaned) {
    throw new AppError("Name is required for ID generation", 400);
  }

  return cleaned.slice(0, 2).padEnd(2, "X");
};

const generateInitialsPrefix = (name) => {
  const normalized = String(name || "").trim();
  if (!normalized) {
    throw new AppError("Name is required for ID generation", 400);
  }

  const initials = normalized
    .split(/\s+/)
    .map((part) => String(part || "").replace(/[^A-Za-z]/g, ""))
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (initials.length >= 2) {
    return initials.slice(0, 2);
  }

  return generateNameAbbreviation(normalized);
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

const generateUserId = (user) => {
  const payload = user && typeof user === "object" ? user : {};

  if (!String(payload.name || "").trim()) {
    throw new AppError("name is required for ID generation", 400);
  }

  if (payload.registrationYear === null || payload.registrationYear === undefined || payload.registrationYear === "") {
    throw new AppError("registrationYear is required for ID generation", 400);
  }

  if (!String(payload.mobile || payload.phone || "").trim()) {
    throw new AppError("mobile or phone is required for ID generation", 400);
  }

  // Step 1: Get first 2 initials ONLY
  const nameParts = String(payload.name).trim().split(" ");

  let initials = "";

  for (let i = 0; i < nameParts.length; i += 1) {
    if (nameParts[i].length > 0) {
      initials += nameParts[i][0];
    }
  }

  initials = initials.substring(0, 2).toUpperCase();

  // Step 2: Get correct year (last 2 digits)
  let year = "";

  if (payload.registrationYear) {
    year = String(payload.registrationYear).slice(-2);
  } else if (payload.createdAt) {
    year = new Date(payload.createdAt)
      .getFullYear()
      .toString()
      .slice(-2);
  }

  // Step 3: Get last 2 digits of mobile
  const mobileLast2 = String(payload.mobile || payload.phone).slice(-2);

  // Final ID
  const finalId = `${initials}${year}${mobileLast2}`;

  console.log("Generated ID:", finalId);

  return finalId;
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
  generateUserId,
  generateNameAbbreviation,
  generateInitialsPrefix,
  extractLastTwoDigits,
  extractYearLastTwoDigits,
  generatePatientId,
  generateDoctorId,
  generateHospitalId,
  ensureUniqueGeneratedId,
};
