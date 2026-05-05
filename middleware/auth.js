const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

const getBearerToken = (authorizationHeader = "") => {
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const auth = asyncHandler(async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization || "");

  if (!token) {
    throw new AppError("Unauthorized: token missing or malformed", 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "replace-this-secret-in-production");
    req.user = decoded;
    return next();
  } catch (error) {
    throw new AppError("Unauthorized: invalid or expired token", 401);
  }
});

module.exports = auth;