const mongoose = require("mongoose");

const medicalReportSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    fileUrl: { type: String, required: true, trim: true },
    issuedBy: { type: String, trim: true, maxlength: 150, default: "" },
    reportDate: { type: Date, required: true, index: true },
    tags: [{ type: String, trim: true, maxlength: 50 }],
  },
  { timestamps: true }
);

medicalReportSchema.index({ patientId: 1, reportDate: -1 });

module.exports = mongoose.model("MedicalReport", medicalReportSchema);
