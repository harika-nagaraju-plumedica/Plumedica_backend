const crypto = require("crypto");

const getPepper = () => process.env.PASSWORD_RESET_TOKEN_PEPPER || process.env.JWT_SECRET || "replace-this-secret-in-production";

const generateRawResetToken = () => crypto.randomBytes(32).toString("hex");

const hashSensitiveValue = (value = "") => {
  return crypto.createHmac("sha256", getPepper()).update(String(value)).digest("hex");
};

module.exports = {
  generateRawResetToken,
  hashSensitiveValue,
};
