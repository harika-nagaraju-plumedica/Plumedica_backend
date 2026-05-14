const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    dosage: { type: String, trim: true, maxlength: 80, default: "" },
    frequency: { type: String, trim: true, maxlength: 120, default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    prescribedByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

medicationSchema.index({ patientId: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Medication", medicationSchema);
