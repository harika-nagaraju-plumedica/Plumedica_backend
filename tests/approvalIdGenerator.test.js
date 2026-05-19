const test = require("node:test");
const assert = require("node:assert/strict");

const { generateUserId } = require("../utils/approvalIdGenerator");

test("generates ID from initials + year(last2) + mobile(last2)", () => {
  const id = generateUserId({
    name: "Harika Nagaraju",
    registrationYear: 2026,
    mobile: "9876543212",
  });

  assert.equal(id, "HN2612");
});

test("generates ID when registrationYear is a Date", () => {
  const id = generateUserId({
    name: "A P",
    registrationYear: new Date("2025-06-01T00:00:00.000Z"),
    mobile: "9012345610",
  });

  assert.equal(id, "AP2510");
});

test("generates ID for single-word names with first two letters", () => {
  const id = generateUserId({
    name: "Rakesh",
    registrationYear: "2023",
    mobile: "9999999909",
  });

  assert.equal(id, "RA2309");
});

test("throws when name is missing", () => {
  assert.throws(
    () =>
      generateUserId({
        name: "",
        registrationYear: 2026,
        mobile: "9876543212",
      }),
    /name is required for ID generation/i
  );
});

test("throws when registrationYear is missing", () => {
  assert.throws(
    () =>
      generateUserId({
        name: "Harika Nagaraju",
        mobile: "9876543212",
      }),
    /registrationYear is required for ID generation/i
  );
});

test("throws when mobile is missing", () => {
  assert.throws(
    () =>
      generateUserId({
        name: "Harika Nagaraju",
        registrationYear: 2026,
        mobile: "",
      }),
    /mobile is required for ID generation/i
  );
});
