const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidEmail,
  isValidPhone,
  isValidResetTokenFormat,
  validatePasswordPolicy,
} = require("../utils/passwordResetValidation");

test("accepts valid email identifiers", () => {
  assert.equal(isValidEmail("doctor@example.com"), true);
});

test("accepts E.164 phone identifiers", () => {
  assert.equal(isValidPhone("+14155552671"), true);
});

test("rejects invalid reset token formats", () => {
  assert.equal(isValidResetTokenFormat("short-token"), false);
});

test("rejects weak password policy", () => {
  const result = validatePasswordPolicy("weak");
  assert.equal(result.isValid, false);
  assert.ok(result.failures.length > 0);
});
