const mongoose = require("mongoose");

const employerSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
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

employerSchema.index({ status: 1, createdAt: -1 });
employerSchema.index({ companyName: 1 });
employerSchema.index({ email: 1 });

module.exports = mongoose.model("Employer", employerSchema);
