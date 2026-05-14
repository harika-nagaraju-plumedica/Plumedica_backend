const mongoose = require("mongoose");

const sosAlertSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, trim: true, default: "" },
    },
    message: { type: String, trim: true, maxlength: 500, default: "" },
    status: {
      type: String,
      enum: ["TRIGGERED", "NOTIFIED", "FAILED", "RESOLVED"],
      default: "TRIGGERED",
      index: true,
    },
    notifiedContacts: [
      {
        contactId: { type: mongoose.Schema.Types.ObjectId, ref: "EmergencyContact" },
        phone: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, default: "" },
        notifiedAt: { type: Date, default: Date.now },
      },
    ],
    triggeredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

sosAlertSchema.index({ patientId: 1, triggeredAt: -1 });

module.exports = mongoose.model("SOSAlert", sosAlertSchema);
