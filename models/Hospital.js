const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    hospitalName: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    gstNumber: { type: String, required: true, trim: true, uppercase: true, unique: true },
    ceRegistrationNumber: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    tokenVersion: { type: Number, default: 0 },
    registrationYear: { type: Number, min: 1900, max: 3000 },
    mobile: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    gstCertificate: { type: String, required: true },
    ceLicense: { type: String, required: true },
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

hospitalSchema.index({ status: 1, createdAt: -1 });
hospitalSchema.index({ hospitalName: 1 });
hospitalSchema.index({ email: 1 });
hospitalSchema.index({ city: 1 });
hospitalSchema.index({ generatedId: 1 });

module.exports = mongoose.model("Hospital", hospitalSchema);
