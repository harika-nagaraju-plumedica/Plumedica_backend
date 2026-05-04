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
    mobile: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    gstCertificate: { type: String, required: true },
    ceLicense: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending Verification", "Approved", "Rejected"],
      default: "Pending Verification",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hospital", hospitalSchema);
