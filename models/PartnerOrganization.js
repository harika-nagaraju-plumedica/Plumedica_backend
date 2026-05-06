const mongoose = require("mongoose");

const partnerOrganizationSchema = new mongoose.Schema(
  {
    organizationName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    tokenVersion: { type: Number, default: 0 },
    mobile: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true, unique: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

partnerOrganizationSchema.index({ status: 1, createdAt: -1 });
partnerOrganizationSchema.index({ organizationName: 1 });
partnerOrganizationSchema.index({ email: 1 });

module.exports = mongoose.model("PartnerOrganization", partnerOrganizationSchema);
