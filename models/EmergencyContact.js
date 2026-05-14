const mongoose = require("mongoose");

const emergencyContactSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    relation: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
    priority: { type: Number, min: 1, max: 10, default: 1 },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

emergencyContactSchema.index({ patientId: 1, priority: 1 });

module.exports = mongoose.model("EmergencyContact", emergencyContactSchema);
