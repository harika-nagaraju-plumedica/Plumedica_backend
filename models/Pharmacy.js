const mongoose = require("mongoose");

const pharmacySchema = new mongoose.Schema(
  {
    legalPharmacyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    gstNumber: { type: String, required: true, trim: true, uppercase: true, unique: true },
    hasDrugLicense: { type: Boolean, default: false },
    gstCertificate: { type: String, required: true },
    drugLicense: { type: String, default: null },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

pharmacySchema.index({ status: 1, createdAt: -1 });
pharmacySchema.index({ legalPharmacyName: 1 });
pharmacySchema.index({ email: 1 });
pharmacySchema.index({ city: 1 });

module.exports = mongoose.model("Pharmacy", pharmacySchema);
