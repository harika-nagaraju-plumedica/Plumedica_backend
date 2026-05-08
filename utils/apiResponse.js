const TIMESTAMP_KEYS = new Set(["createdAt", "updatedAt"]);
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const formatToIST = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  // Shift UTC time by +05:30 and emit as ISO-like string with IST offset.
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().replace("Z", "+05:30");
};

const convertTimestampsToIST = (input) => {
  if (Array.isArray(input)) {
    return input.map(convertTimestampsToIST);
  }

  if (!input || typeof input !== "object") {
    return input;
  }

  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (TIMESTAMP_KEYS.has(key) && (value instanceof Date || typeof value === "string")) {
      output[key] = formatToIST(value);
      continue;
    }

    output[key] = convertTimestampsToIST(value);
  }

  return output;
};

const sendResponse = (res, statusCode, success, message, data = {}, errorCode = null) => {
  return res.status(statusCode).json({
    success,
    message,
    data: convertTimestampsToIST(data),
    errorCode,
  });
};

module.exports = sendResponse;
