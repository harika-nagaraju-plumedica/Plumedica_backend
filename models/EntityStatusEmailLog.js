const mongoose = require("mongoose");

const entityStatusEmailLogSchema = new mongoose.Schema(
  {
    entityKey: { type: String, required: true, trim: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    to: { type: String, required: true, trim: true, lowercase: true },
    recipientName: { type: String, default: "", trim: true },
    entityLabel: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Approved", "Rejected"],
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    provider: { type: String, default: "smtp", trim: true },
    deliveryStatus: {
      type: String,
      enum: ["sent", "failed"],
      required: true,
    },
    attempts: { type: Number, default: 1 },
    errorMessage: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

entityStatusEmailLogSchema.index({ entityKey: 1, recordId: 1, createdAt: -1 });
entityStatusEmailLogSchema.index({ to: 1, createdAt: -1 });
entityStatusEmailLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("EntityStatusEmailLog", entityStatusEmailLogSchema);
