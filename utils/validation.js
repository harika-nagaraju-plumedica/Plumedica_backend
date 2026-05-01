const validateRequiredFields = (payload, requiredFields = []) => {
  return requiredFields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === "";
  });
};

module.exports = {
  validateRequiredFields,
};
