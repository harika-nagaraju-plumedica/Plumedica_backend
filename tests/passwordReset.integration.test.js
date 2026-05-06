const test = require("node:test");

// Integration scaffolding for password reset APIs.
// These tests are intentionally marked as TODO and should be implemented with
// a dedicated test database + HTTP client in CI.

test.todo("forgot-password happy path returns generic success response");
test.todo("reset-password fails for invalid token");
test.todo("reset-password fails for expired token");
test.todo("reset-password fails for reused token");
test.todo("forgot-password rate limiting blocks brute-force attempts");
