const mongoose = require("mongoose");

const employerSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    tokenVersion: { type: Number, default: 0 },
    mobile: { type: String, required: true, trim: true },
    registrationYear: { type: Number, required: true, min: 1900, max: 3000 },
    generatedId: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

employerSchema.index({ status: 1, createdAt: -1 });
employerSchema.index({ companyName: 1 });
employerSchema.index({ email: 1 });
employerSchema.index({ generatedId: 1 });

module.exports = mongoose.model("Employer", employerSchema);
