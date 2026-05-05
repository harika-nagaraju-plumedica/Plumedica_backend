require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Admin = require("../models/Admin");

const requiredEnv = ["ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"];

const validateEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key] || !String(process.env[key]).trim());

  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
};

const seedAdmin = async () => {
  validateEnv();

  const name = String(process.env.ADMIN_NAME).trim();
  const email = String(process.env.ADMIN_EMAIL).trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD);
  const role = ["admin", "superadmin"].includes(String(process.env.ADMIN_ROLE || "").toLowerCase())
    ? String(process.env.ADMIN_ROLE).toLowerCase()
    : "superadmin";

  await connectDB();

  const passwordHash = await bcrypt.hash(password, 10);

  const existingAdmin = await Admin.findOne({ email });

  if (existingAdmin) {
    existingAdmin.name = name;
    existingAdmin.password = passwordHash;
    existingAdmin.role = role;
    await existingAdmin.save();

    console.log(`Admin updated: ${email} (${role})`);
  } else {
    await Admin.create({
      name,
      email,
      password: passwordHash,
      role,
    });

    console.log(`Admin created: ${email} (${role})`);
  }
};

seedAdmin()
  .catch((error) => {
    console.error("Failed to seed admin:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (error) {
      // Best-effort disconnect for script exit.
    }
  });
