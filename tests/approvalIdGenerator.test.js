const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateUserId,
  getInitialCombinations,
  generateUniqueUserId,
} = require("../utils/approvalIdGenerator");

test("generates ID from initials + year(last2) + mobile(last2)", () => {
  const id = generateUserId({
    name: "Harika Nagaraju",
    registrationYear: 2026,
    mobile: "9876543212",
  });

  assert.equal(id, "HN2612");
});

test("generates ID for single name as first two letters", () => {
  const id = generateUserId({
    name: "Harika",
    registrationYear: 2026,
    mobile: "9876543212",
  });

  assert.equal(id, "HA2612");
});

test("ignores Dr prefix for single-name input", () => {
  const id = generateUserId({
    name: "Dr Harika",
    registrationYear: 2026,
    mobile: "9876543212",
  });

  assert.equal(id, "HA2612");
});

test("ignores Dr. prefix for full-name input", () => {
  const id = generateUserId({
    name: "Dr. Harika Nagaraju",
    registrationYear: 2026,
    mobile: "9876543212",
  });

  assert.equal(id, "HN2612");
});

test("ignores Mr prefix for full-name input", () => {
  const id = generateUserId({
    name: "Mr Krishna Reddy",
    registrationYear: 2026,
    mobile: "9876543212",
  });

  assert.equal(id, "KR2612");
});

test("generates ID for Apollo Hospital example", () => {
  const id = generateUserId({
    name: "Apollo Hospital",
    registrationYear: 2025,
    mobile: "9012345610",
  });

  assert.equal(id, "AH2510");
});

test("generates ID from multi-part name initials only", () => {
  const id = generateUserId({
    name: "Krishna Reddy",
    registrationYear: "2023",
    mobile: "9999999909",
  });

  assert.equal(id, "KR2309");
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
    /mobile or phone is required for ID generation/i
  );
});

test("builds two-letter combinations from unique name letters", () => {
  const combinations = getInitialCombinations("Harika Nagaraju");

  assert.ok(combinations.includes("HN"));
  assert.ok(combinations.includes("HA"));
  assert.ok(combinations.includes("HR"));
  assert.ok(combinations.includes("AN"));
});

test("resolves duplicate user ID using name-letter combinations before numeric fallback", async () => {
  const usedIds = new Set(["HN2612"]);

  const model = {
    exists: async ({ generatedId }) => usedIds.has(String(generatedId).toUpperCase()),
  };

  const id = await generateUniqueUserId({
    model,
    user: {
      name: "Harika Nagaraju",
      registrationYear: 2026,
      mobile: "9876543212",
    },
  });

  assert.notEqual(id, "HN2612");
  assert.match(id, /^[A-Z]{2}2612$/);
});

test("falls back to numeric suffix only after all letter-combination IDs are used", async () => {
  const yearAndPhone = "2612";
  const prefixes = ["HN", ...getInitialCombinations("Harika Nagaraju")];
  const usedIds = new Set(prefixes.map((prefix) => `${prefix}${yearAndPhone}`.toUpperCase()));

  const model = {
    exists: async ({ generatedId }) => usedIds.has(String(generatedId).toUpperCase()),
  };

  const id = await generateUniqueUserId({
    model,
    user: {
      name: "Harika Nagaraju",
      registrationYear: 2026,
      mobile: "9876543212",
    },
  });

  assert.match(id, /^HN2612\d+$/);
});
