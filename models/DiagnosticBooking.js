const mongoose = require("mongoose");

const diagnosticBookingSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    diagnosticCenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiagnosticsCenter",
      required: true,
      index: true,
    },
    testName: { type: String, required: true, trim: true, maxlength: 120 },
    slotDateTime: { type: Date, required: true, index: true },
    status: { type: String, enum: ["BOOKED", "COMPLETED", "CANCELLED"], default: "BOOKED" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

diagnosticBookingSchema.index({ patientId: 1, slotDateTime: -1 });

module.exports = mongoose.model("DiagnosticBooking", diagnosticBookingSchema);
