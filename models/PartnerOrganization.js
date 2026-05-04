const mongoose = require("mongoose");

const partnerOrganizationSchema = new mongoose.Schema(
  {
    organizationName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    mobile: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true, unique: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PartnerOrganization", partnerOrganizationSchema);
