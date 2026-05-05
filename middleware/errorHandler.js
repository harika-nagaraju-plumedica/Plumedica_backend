const multer = require("multer");
const AppError = require("../utils/AppError");
const sendResponse = require("../utils/apiResponse");

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((detail) => detail.message)
      .join(", ");
  }

  if (err.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(err.keyPattern || {}).join(", ");
    message = `${duplicateField || "Unique field"} already exists`;
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path || "value"} format`;
  }

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = err.message;
  }

  return sendResponse(res, statusCode, false, message, {});
};

module.exports = {
  notFound,
  errorHandler,
};
