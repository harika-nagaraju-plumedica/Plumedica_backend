const jwt = require("jsonwebtoken");

const getJwtSecret = () => {
  return process.env.JWT_SECRET || "replace-this-secret-in-production";
};

const generateToken = (payload) => {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

module.exports = {
  generateToken,
};
