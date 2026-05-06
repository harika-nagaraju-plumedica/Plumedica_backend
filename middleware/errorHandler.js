const multer = require("multer");
const AppError = require("../utils/AppError");
const sendResponse = require("../utils/apiResponse");

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404, "ROUTE_NOT_FOUND"));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errorCode = err.errorCode || "INTERNAL_SERVER_ERROR";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((detail) => detail.message)
      .join(", ");
    errorCode = "VALIDATION_ERROR";
  }

  if (err.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(err.keyPattern || {}).join(", ");
    message = `${duplicateField || "Unique field"} already exists`;
    errorCode = "DUPLICATE_VALUE";
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path || "value"} format`;
    errorCode = "INVALID_FORMAT";
  }

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = err.message;
    errorCode = "UPLOAD_ERROR";
  }

  return sendResponse(res, statusCode, false, message, {}, errorCode);
};

module.exports = {
  notFound,
  errorHandler,
};
