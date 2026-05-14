const express = require("express");
const auth = require("../../middleware/auth");
const patientOnly = require("../../middleware/patientOnly");
const {
  getDashboard,
  getPatientProfile,
  updatePatientProfile,
  getMedicalHistory,
  addHealthMetric,
  getLatestHealthMetrics,
  getHealthMetricsHistory,
  triggerSosAlert,
  bookAppointment,
  getUpcomingAppointments,
  cancelAppointment,
  getDoctorsList,
  getReferralDoctors,
  listDiagnosticCenters,
  bookDiagnosticTest,
  createEmergencyContact,
  listEmergencyContacts,
  updateEmergencyContact,
  deleteEmergencyContact,
} = require("../../controllers/patient/dashboardController");

const router = express.Router();

router.use(auth, patientOnly);

router.get("/dashboard", getDashboard);

router.get("/profile", getPatientProfile);
router.put("/profile", updatePatientProfile);

router.get("/medical-history", getMedicalHistory);

router.post("/health-metrics", addHealthMetric);
router.get("/health-metrics/latest", getLatestHealthMetrics);
router.get("/health-metrics/history", getHealthMetricsHistory);

router.post("/sos/trigger", triggerSosAlert);

router.post("/appointments", bookAppointment);
router.get("/appointments/upcoming", getUpcomingAppointments);
router.put("/appointments/:appointmentId/cancel", cancelAppointment);

router.get("/doctors", getDoctorsList);
router.get("/doctors/referrals", getReferralDoctors);

router.get("/diagnostics/centers", listDiagnosticCenters);
router.post("/diagnostics/bookings", bookDiagnosticTest);

router.post("/emergency-contacts", createEmergencyContact);
router.get("/emergency-contacts", listEmergencyContacts);
router.put("/emergency-contacts/:contactId", updateEmergencyContact);
router.delete("/emergency-contacts/:contactId", deleteEmergencyContact);

module.exports = router;
