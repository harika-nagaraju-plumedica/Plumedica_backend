const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { getModelByRole, parseObjectId } = require("../utils/passwordResetModules");

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

    const Model = getModelByRole(decoded.role);
    if (Model && decoded.id) {
      const userId = parseObjectId(decoded.id);
      const authUser = userId ? await Model.findById(userId).select("tokenVersion") : null;
      if (!authUser) {
        throw new AppError("Unauthorized: user not found", 401, "UNAUTHORIZED_USER_NOT_FOUND");
      }

      const tokenVersion = Number(decoded.tokenVersion || 0);
      const storedVersion = Number(authUser.tokenVersion || 0);
      if (tokenVersion !== storedVersion) {
        throw new AppError("Unauthorized: session has been invalidated", 401, "SESSION_INVALIDATED");
      }
    }

    req.user = decoded;
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Unauthorized: invalid or expired token", 401, "UNAUTHORIZED_INVALID_TOKEN");
  }
});

module.exports = auth;