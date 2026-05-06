const sendResponse = (res, statusCode, success, message, data = {}, errorCode = null) => {
  return res.status(statusCode).json({
    success,
    message,
    data,
    errorCode,
  });
};

module.exports = sendResponse;
