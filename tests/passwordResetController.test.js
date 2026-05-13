const test = require("node:test");
const assert = require("node:assert/strict");

const passwordResetService = require("../services/passwordResetService");
const { buildPasswordResetController } = require("../controllers/auth/passwordResetController");

const createMockRes = () => {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };

  return res;
};

test("reset-password accepts token from request body", async () => {
  const originalResetPassword = passwordResetService.resetPassword;
  const captured = {};

  passwordResetService.resetPassword = async (payload) => {
    captured.payload = payload;
    return { message: "Password reset successful" };
  };

  try {
    const controller = buildPasswordResetController("user");
    const req = {
      body: {
        token: "a".repeat(64),
        newPassword: "StrongP@ssword1",
        confirmPassword: "StrongP@ssword1",
      },
      params: {},
      query: {},
      headers: {},
    };
    const res = createMockRes();

    await controller.resetPassword(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(captured.payload.token, "a".repeat(64));
  } finally {
    passwordResetService.resetPassword = originalResetPassword;
  }
});

test("reset-password accepts token from URL param and prefers it over body token", async () => {
  const originalResetPassword = passwordResetService.resetPassword;
  const captured = {};

  passwordResetService.resetPassword = async (payload) => {
    captured.payload = payload;
    return { message: "Password reset successful" };
  };

  try {
    const controller = buildPasswordResetController("user");
    const req = {
      body: {
        token: "b".repeat(64),
        newPassword: "StrongP@ssword1",
        confirmPassword: "StrongP@ssword1",
      },
      params: {
        token: "c".repeat(64),
      },
      query: {},
      headers: {},
    };
    const res = createMockRes();

    await controller.resetPassword(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(captured.payload.token, "c".repeat(64));
  } finally {
    passwordResetService.resetPassword = originalResetPassword;
  }
});
