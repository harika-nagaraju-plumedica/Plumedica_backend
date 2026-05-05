const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    mobile: { type: String, required: true, trim: true },
    gender: { type: String, required: true, trim: true },
    bloodGroup: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

patientSchema.index({ status: 1, createdAt: -1 });
patientSchema.index({ fullName: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ address: 1 });

module.exports = mongoose.model("Patient", patientSchema);
