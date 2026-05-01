const mongoose = require("mongoose");

const availabilitySlotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    slots: [
      {
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
      },
    ],
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    qualification: { type: String, required: true, trim: true },
    specialization: { type: String, trim: true },
    yearOfGraduation: { type: Number, required: true },
    yearsOfExperience: { type: Number, required: true },
    clinicAddress: { type: String, required: true, trim: true },
    medicalLicenseNumber: { type: String, required: true, trim: true, unique: true },
    medicalLicenseDocument: { type: String, default: null },
    availabilitySlots: {
      type: [availabilitySlotSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "availabilitySlots must include at least one day",
      },
    },
    status: {
      type: String,
      enum: ["Pending Approval", "Approved", "Rejected"],
      default: "Pending Approval",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);
