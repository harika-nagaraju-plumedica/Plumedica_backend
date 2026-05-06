const mongoose = require("mongoose");

const passwordResetRequestLogSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, required: true, trim: true },
    identifierHash: { type: String, required: true, trim: true },
    ipHash: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetRequestLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetRequestLogSchema.index({ moduleKey: 1, identifierHash: 1, ipHash: 1, createdAt: -1 });

module.exports = mongoose.model("PasswordResetRequestLog", passwordResetRequestLogSchema);
