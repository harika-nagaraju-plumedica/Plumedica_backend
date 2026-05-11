const mongoose = require("mongoose");

const approvalUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    dob: { type: Date, default: null },
    registrationYear: { type: Number, default: null },
    role: {
      type: String,
      required: true,
      enum: ["patient", "doctor", "hospital"],
      lowercase: true,
      trim: true,
    },
    generatedId: { type: String, required: true, trim: true, uppercase: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

approvalUserSchema.index({ role: 1, status: 1, createdAt: -1 });
approvalUserSchema.index({ email: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("ApprovalUser", approvalUserSchema);
