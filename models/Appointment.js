const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },
    slotStart: { type: Date, required: true, index: true },
    slotEnd: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    status: {
      type: String,
      enum: ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "BOOKED",
      index: true,
    },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

appointmentSchema.index({ patientId: 1, slotStart: 1 });
appointmentSchema.index({ doctorId: 1, slotStart: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
