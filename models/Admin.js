const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    tokenVersion: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ["superadmin", "admin", "SUPER_ADMIN", "ADMIN"],
      default: "admin",
    },
    permissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);