const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const doctorRoutes = require("./routes/doctor/doctorRoutes");
const pharmacyRoutes = require("./routes/pharmacy/pharmacyRoutes");
const patientRoutes = require("./routes/patient/patientRoutes");
const hospitalRoutes = require("./routes/hospital/hospitalRoutes");
const diagnosticsRoutes = require("./routes/diagnostics/diagnosticsRoutes");
const partnerRoutes = require("./routes/partner/partnerRoutes");
const jobSeekerRoutes = require("./routes/jobSeeker/jobSeekerRoutes");
const employerRoutes = require("./routes/employer/employerRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PluMedica backend is running",
    data: {},
  });
});

app.use("/api/doctors", doctorRoutes);
app.use("/api/pharmacies", pharmacyRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/diagnostics-centers", diagnosticsRoutes);
app.use("/api/partner-organizations", partnerRoutes);
app.use("/api/job-seekers", jobSeekerRoutes);
app.use("/api/employers", employerRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;