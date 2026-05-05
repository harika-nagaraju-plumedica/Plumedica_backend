require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Admin = require("../models/Admin");

const DEFAULT_ADMIN = {
  name: "Super Admin",
  email: "admin@plumedica.com",
  password: "super123",
  role: "superadmin",
};

const seedAdmin = async () => {
  const name = String(process.env.ADMIN_NAME || DEFAULT_ADMIN.name).trim();
  const email = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN.email)
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN.password);
  const role = ["admin", "superadmin"].includes(String(process.env.ADMIN_ROLE || "").toLowerCase())
    ? String(process.env.ADMIN_ROLE).toLowerCase()
    : DEFAULT_ADMIN.role;

  const usingDefaults = !process.env.ADMIN_NAME || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD;
  if (usingDefaults) {
    console.warn("ADMIN_* env vars not fully set. Using development defaults for seed admin.");
  }

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
