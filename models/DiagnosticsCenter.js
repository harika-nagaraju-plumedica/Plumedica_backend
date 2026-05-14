const mongoose = require("mongoose");

const diagnosticsCenterSchema = new mongoose.Schema(
  {
    centerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    city: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    testsOffered: [{ type: String, trim: true }],
    rating: { type: Number, min: 0, max: 5, default: 0 },
    isActive: { type: Boolean, default: true },
    password: { type: String, required: true, minlength: 6 },
    tokenVersion: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

diagnosticsCenterSchema.index({ status: 1, isActive: 1, createdAt: -1 });
diagnosticsCenterSchema.index({ centerName: 1 });
diagnosticsCenterSchema.index({ city: 1 });
diagnosticsCenterSchema.index({ testsOffered: 1 });

module.exports = mongoose.model("DiagnosticsCenter", diagnosticsCenterSchema);
