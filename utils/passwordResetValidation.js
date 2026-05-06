const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const RESET_TOKEN_REGEX = /^[a-f0-9]{64}$/;

const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

const normalizeIdentifier = (identifier = "") => String(identifier).trim();

const isValidEmail = (value = "") => EMAIL_REGEX.test(String(value).trim().toLowerCase());

const isValidPhone = (value = "") => PHONE_REGEX.test(String(value).trim());

const validatePasswordPolicy = (password = "") => {
  const value = String(password);
  const failures = [];

  if (value.length < PASSWORD_POLICY.minLength) {
    failures.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(value)) {
    failures.push("Password must include at least one uppercase letter");
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(value)) {
    failures.push("Password must include at least one lowercase letter");
  }

  if (PASSWORD_POLICY.requireNumber && !/\d/.test(value)) {
    failures.push("Password must include at least one number");
  }

  if (PASSWORD_POLICY.requireSpecial && !/[^A-Za-z0-9]/.test(value)) {
    failures.push("Password must include at least one special character");
  }

  return {
    isValid: failures.length === 0,
    failures,
  };
};

const isValidResetTokenFormat = (token = "") => RESET_TOKEN_REGEX.test(String(token).trim());

module.exports = {
  PASSWORD_POLICY,
  normalizeIdentifier,
  isValidEmail,
  isValidPhone,
  validatePasswordPolicy,
  isValidResetTokenFormat,
};
