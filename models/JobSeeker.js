const mongoose = require("mongoose");

const jobSeekerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    tokenVersion: { type: Number, default: 0 },
    phone: { type: String, required: true, trim: true },
    experience: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

jobSeekerSchema.index({ status: 1, createdAt: -1 });
jobSeekerSchema.index({ fullName: 1 });
jobSeekerSchema.index({ email: 1 });

module.exports = mongoose.model("JobSeeker", jobSeekerSchema);
