const mongoose = require("mongoose");

const METRIC_TYPES = ["BP_SYS", "BP_DIA", "HEART_RATE", "WEIGHT", "SPO2"];

const healthMetricSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    metricType: { type: String, enum: METRIC_TYPES, required: true, index: true },
    value: { type: Number, required: true },
    unit: { type: String, trim: true, maxlength: 20, default: "" },
    measuredAt: { type: Date, required: true, index: true },
    source: { type: String, enum: ["MANUAL", "DEVICE", "LAB"], default: "MANUAL" },
  },
  { timestamps: true }
);

healthMetricSchema.index({ patientId: 1, metricType: 1, measuredAt: -1 });
healthMetricSchema.index({ patientId: 1, metricType: 1, measuredAt: 1 }, { unique: true });

module.exports = mongoose.model("HealthMetric", healthMetricSchema);
