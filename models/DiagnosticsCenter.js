const mongoose = require("mongoose");

const diagnosticsCenterSchema = new mongoose.Schema(
  {
    centerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    tokenVersion: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiagnosticsCenter", diagnosticsCenterSchema);
