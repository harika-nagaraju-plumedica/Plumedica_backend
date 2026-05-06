const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    identifierHash: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true, unique: true, trim: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ moduleKey: 1, userId: 1, createdAt: -1 });
passwordResetTokenSchema.index({ moduleKey: 1, identifierHash: 1, createdAt: -1 });

module.exports = mongoose.model("PasswordResetToken", passwordResetTokenSchema);
