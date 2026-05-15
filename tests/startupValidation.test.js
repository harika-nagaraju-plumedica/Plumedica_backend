const test = require("node:test");
const assert = require("node:assert/strict");

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SENDGRID_API_KEY;
  delete process.env.APPROVAL_FROM_EMAIL;
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

test("passes in production when strict mode is not explicitly enabled", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";

  assert.equal(validateStartupConfig(), true);
});

test("fails in production when strict mode is enabled and no provider is configured", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";
  process.env.PASSWORD_RESET_REQUIRE_DELIVERY = "true";

  assert.throws(() => validateStartupConfig(), {
    message: /no provider is configured/i,
  });
});

test("fails when SendGrid config is missing in strict mode", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";
  process.env.PASSWORD_RESET_REQUIRE_DELIVERY = "true";
  process.env.SENDGRID_API_KEY = "";

  assert.throws(() => validateStartupConfig(), {
    message: /no provider is configured/i,
  });
});

test("passes when SendGrid config is complete in strict mode", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";
  process.env.PASSWORD_RESET_REQUIRE_DELIVERY = "true";
  process.env.SENDGRID_API_KEY = "SG.mock-key";

  assert.equal(validateStartupConfig(), true);
});

test("passes when SendGrid config is complete with APPROVAL_FROM_EMAIL in strict mode", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "production";
  process.env.PASSWORD_RESET_REQUIRE_DELIVERY = "true";
  process.env.SENDGRID_API_KEY = "SG.mock-key";
  process.env.APPROVAL_FROM_EMAIL = "info@plumedica.com";

  assert.equal(validateStartupConfig(), true);
});

test("passes when strict mode is disabled", () => {
  const { validateStartupConfig } = require("../utils/startupValidation");
  process.env.NODE_ENV = "development";
  process.env.PASSWORD_RESET_REQUIRE_DELIVERY = "false";

  assert.equal(validateStartupConfig(), true);
});
