const mongoose = require("mongoose");

const pharmacySchema = new mongoose.Schema(
  {
    legalPharmacyName: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    gstNumber: { type: String, required: true, trim: true, uppercase: true, unique: true },
    hasDrugLicense: { type: Boolean, default: false },
    gstCertificate: { type: String, required: true },
    drugLicense: { type: String, default: null },
    status: {
      type: String,
      enum: ["Pending Verification", "Approved", "Rejected"],
      default: "Pending Verification",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pharmacy", pharmacySchema);
