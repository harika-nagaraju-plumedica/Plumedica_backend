const test = require("node:test");
const assert = require("node:assert/strict");

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
};

test.beforeEach(() => {
  resetEnv();
});

test.after(() => {
  process.env = ORIGINAL_ENV;
});

test("fails in production when no provider is configured", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";

  assert.throws(() => validateStartupConfig(), {
    message: /no provider is configured/i,
  });
});

test("fails when SMTP config is partial in strict mode", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";
  process.env.SMTP_HOST = "smtp.example.com";

  assert.throws(() => validateStartupConfig(), {
    message: /SMTP config is incomplete/i,
  });
});

test("passes when SMTP config is complete in strict mode", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "user";
  process.env.SMTP_PASS = "pass";
  process.env.SMTP_FROM = "no-reply@example.com";

  assert.equal(validateStartupConfig(), true);
});

test("passes when strict mode is disabled", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "development";
  process.env.PASSWORD_RESET_REQUIRE_DELIVERY = "false";

  assert.equal(validateStartupConfig(), true);
});
