const mongoose = require("mongoose");
const asyncHandler = require("../../utils/asyncHandler");
const sendResponse = require("../../utils/apiResponse");
const AppError = require("../../utils/AppError");
const { parsePagination } = require("../../utils/pagination");

const Patient = require("../../models/Patient");
const Appointment = require("../../models/Appointment");
const Medication = require("../../models/Medication");
const MedicalReport = require("../../models/MedicalReport");
const HealthMetric = require("../../models/HealthMetric");
const EmergencyContact = require("../../models/EmergencyContact");
const SOSAlert = require("../../models/SOSAlert");
const Doctor = require("../../models/Doctor");
const DiagnosticsCenter = require("../../models/DiagnosticsCenter");
const DiagnosticBooking = require("../../models/DiagnosticBooking");

const METRIC_LIMITS = {
  BP_SYS: { min: 50, max: 250, defaultUnit: "mmHg" },
  BP_DIA: { min: 30, max: 150, defaultUnit: "mmHg" },
  HEART_RATE: { min: 20, max: 240, defaultUnit: "bpm" },
  WEIGHT: { min: 2, max: 400, defaultUnit: "kg" },
  SPO2: { min: 50, max: 100, defaultUnit: "%" },
};

const BOOKABLE_APPOINTMENT_STATUSES = ["BOOKED", "CONFIRMED"];
const HISTORY_TYPES = ["all", "appointments", "medications", "reports"];

const resolvePatientId = (req) => {
  const userId = String(req.user?.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Unauthorized: invalid patient id", 401, "UNAUTHORIZED_INVALID_PATIENT_ID");
  }

  return new mongoose.Types.ObjectId(userId);
};

const ensurePatientExists = async (patientId) => {
  const patient = await Patient.findById(patientId).select("fullName email mobile gender bloodGroup address dob generatedId status").lean();
  if (!patient) {
    throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
  }

  return patient;
};

const parseOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  }

  return parsed;
};

const validateDateRange = (from, to) => {
  if (from && to && from > to) {
    throw new AppError("from date must be less than or equal to to date", 400, "VALIDATION_ERROR");
  }
};

const buildDateRangeQuery = (field, from, to) => {
  if (!from && !to) {
    return {};
  }

  const query = {};
  if (from) {
    query.$gte = from;
  }

  if (to) {
    query.$lte = to;
  }

  return { [field]: query };
};

const sanitizePatientProfile = (patient) => {
  return {
    id: String(patient._id),
    fullName: patient.fullName,
    email: patient.email,
    mobile: patient.mobile,
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    address: patient.address,
    dob: patient.dob,
    generatedId: patient.generatedId || "",
    status: patient.status,
  };
};

const getDashboard = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  const patient = await ensurePatientExists(patientId);

  const now = new Date();

  const [upcomingAppointments, activeMedications, reportCount, latestMetrics] = await Promise.all([
    Appointment.countDocuments({
      patientId,
      status: { $in: BOOKABLE_APPOINTMENT_STATUSES },
      slotStart: { $gte: now },
    }),
    Medication.countDocuments({ patientId, isActive: true }),
    MedicalReport.countDocuments({ patientId }),
    HealthMetric.aggregate([
      { $match: { patientId } },
      { $sort: { measuredAt: -1 } },
      {
        $group: {
          _id: "$metricType",
          value: { $first: "$value" },
          unit: { $first: "$unit" },
          measuredAt: { $first: "$measuredAt" },
        },
      },
    ]),
  ]);

  const metricMap = latestMetrics.reduce((acc, item) => {
    acc[item._id] = {
      value: item.value,
      unit: item.unit,
      measuredAt: item.measuredAt,
    };
    return acc;
  }, {});

  return sendResponse(res, 200, true, "Dashboard fetched", {
    patient: {
      id: String(patient._id),
      fullName: patient.fullName,
      generatedId: patient.generatedId || "",
    },
    summary: {
      upcomingAppointments,
      activeMedications,
      reports: reportCount,
    },
    latestMetrics: {
      bloodPressure: metricMap.BP_SYS && metricMap.BP_DIA
        ? `${metricMap.BP_SYS.value}/${metricMap.BP_DIA.value}`
        : "",
      heartRate: metricMap.HEART_RATE || null,
      weight: metricMap.WEIGHT || null,
      oxygenLevel: metricMap.SPO2 || null,
    },
  });
});

const getPatientProfile = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  const patient = await ensurePatientExists(patientId);

  return sendResponse(res, 200, true, "Patient profile fetched", {
    profile: sanitizePatientProfile(patient),
  });
});

const updatePatientProfile = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const allowedFields = ["fullName", "mobile", "gender", "bloodGroup", "address", "dob"];

  const updates = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = body[field];
    }
  }

  if (!Object.keys(updates).length) {
    throw new AppError("No valid profile fields provided", 400, "VALIDATION_ERROR");
  }

  if (updates.dob !== undefined && updates.dob !== null && String(updates.dob).trim() !== "") {
    const parsedDob = new Date(String(updates.dob));
    if (Number.isNaN(parsedDob.getTime()) || parsedDob > new Date()) {
      throw new AppError("Invalid dob", 400, "VALIDATION_ERROR");
    }
    updates.dob = parsedDob;
  }

  const updated = await Patient.findByIdAndUpdate(patientId, { $set: updates }, { new: true })
    .select("fullName email mobile gender bloodGroup address dob generatedId status")
    .lean();

  return sendResponse(res, 200, true, "Patient profile updated", {
    profile: sanitizePatientProfile(updated),
  });
});

const getMedicalHistory = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const type = String(req.query.type || "all").trim().toLowerCase();
  if (!HISTORY_TYPES.includes(type)) {
    throw new AppError("Invalid history type", 400, "VALIDATION_ERROR");
  }

  const from = parseOptionalDate(req.query.from, "from");
  const to = parseOptionalDate(req.query.to, "to");
  validateDateRange(from, to);

  const { page, limit, skip } = parsePagination(req.query);

  if (type === "appointments") {
    const filter = { patientId, ...buildDateRangeQuery("slotStart", from, to) };
    const [items, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ slotStart: -1 })
        .skip(skip)
        .limit(limit)
        .select("doctorId slotStart slotEnd reason status createdAt")
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    return sendResponse(res, 200, true, "Medical history fetched", {
      items,
      meta: { page, limit, total, type },
    });
  }

  if (type === "medications") {
    const filter = { patientId, ...buildDateRangeQuery("startDate", from, to) };
    const [items, total] = await Promise.all([
      Medication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("name dosage frequency startDate endDate isActive notes")
        .lean(),
      Medication.countDocuments(filter),
    ]);

    return sendResponse(res, 200, true, "Medical history fetched", {
      items,
      meta: { page, limit, total, type },
    });
  }

  if (type === "reports") {
    const filter = { patientId, ...buildDateRangeQuery("reportDate", from, to) };
    const [items, total] = await Promise.all([
      MedicalReport.find(filter)
        .sort({ reportDate: -1 })
        .skip(skip)
        .limit(limit)
        .select("type title fileUrl issuedBy reportDate tags")
        .lean(),
      MedicalReport.countDocuments(filter),
    ]);

    return sendResponse(res, 200, true, "Medical history fetched", {
      items,
      meta: { page, limit, total, type },
    });
  }

  const [appointments, medications, reports] = await Promise.all([
    Appointment.find({ patientId, ...buildDateRangeQuery("slotStart", from, to) })
      .sort({ slotStart: -1 })
      .limit(Math.min(limit, 20))
      .select("doctorId slotStart slotEnd reason status")
      .lean(),
    Medication.find({ patientId, ...buildDateRangeQuery("startDate", from, to) })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 20))
      .select("name dosage frequency startDate endDate isActive")
      .lean(),
    MedicalReport.find({ patientId, ...buildDateRangeQuery("reportDate", from, to) })
      .sort({ reportDate: -1 })
      .limit(Math.min(limit, 20))
      .select("type title fileUrl reportDate")
      .lean(),
  ]);

  return sendResponse(res, 200, true, "Medical history fetched", {
    appointments,
    medications,
    reports,
    meta: {
      page,
      limit,
      type,
    },
  });
});

const validateMetricInput = ({ metricType, value, measuredAt }) => {
  const type = String(metricType || "").trim();
  const limits = METRIC_LIMITS[type];

  if (!limits) {
    throw new AppError("Invalid metricType", 400, "VALIDATION_ERROR");
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new AppError("Metric value must be a valid number", 400, "VALIDATION_ERROR");
  }

  if (numericValue < limits.min || numericValue > limits.max) {
    throw new AppError(`Metric value out of range for ${type}`, 422, "VALIDATION_ERROR");
  }

  const measuredAtDate = new Date(String(measuredAt || ""));
  if (Number.isNaN(measuredAtDate.getTime())) {
    throw new AppError("Invalid measuredAt", 400, "VALIDATION_ERROR");
  }

  const maxFutureTime = Date.now() + 5 * 60 * 1000;
  if (measuredAtDate.getTime() > maxFutureTime) {
    throw new AppError("measuredAt cannot be in the future", 422, "VALIDATION_ERROR");
  }

  return { type, numericValue, measuredAtDate, defaultUnit: limits.defaultUnit };
};

const addHealthMetric = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const { type, numericValue, measuredAtDate, defaultUnit } = validateMetricInput(body);

  const unit = String(body.unit || defaultUnit).trim();
  const source = String(body.source || "MANUAL").trim().toUpperCase();

  const metric = await HealthMetric.create({
    patientId,
    metricType: type,
    value: numericValue,
    unit,
    measuredAt: measuredAtDate,
    source,
  }).catch((error) => {
    if (error?.code === 11000) {
      throw new AppError("Duplicate metric entry for same timestamp", 409, "DUPLICATE_METRIC");
    }

    throw error;
  });

  return sendResponse(res, 201, true, "Health metric added", {
    metric: {
      id: String(metric._id),
      metricType: metric.metricType,
      value: metric.value,
      unit: metric.unit,
      measuredAt: metric.measuredAt,
    },
  });
});

const getLatestHealthMetrics = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const metricTypesRaw = String(req.query.metricTypes || "").trim();
  let metricTypes = Object.keys(METRIC_LIMITS);

  if (metricTypesRaw) {
    metricTypes = metricTypesRaw
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    const invalid = metricTypes.filter((item) => !Object.prototype.hasOwnProperty.call(METRIC_LIMITS, item));
    if (invalid.length) {
      throw new AppError(`Invalid metricTypes: ${invalid.join(", ")}`, 400, "VALIDATION_ERROR");
    }
  }

  const metrics = await HealthMetric.aggregate([
    {
      $match: {
        patientId,
        metricType: { $in: metricTypes },
      },
    },
    { $sort: { measuredAt: -1 } },
    {
      $group: {
        _id: "$metricType",
        value: { $first: "$value" },
        unit: { $first: "$unit" },
        measuredAt: { $first: "$measuredAt" },
      },
    },
  ]);

  const latest = metrics.reduce((acc, item) => {
    acc[item._id] = {
      value: item.value,
      unit: item.unit,
      measuredAt: item.measuredAt,
    };
    return acc;
  }, {});

  return sendResponse(res, 200, true, "Latest health metrics fetched", {
    metrics: latest,
  });
});

const getHealthMetricsHistory = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const metricType = String(req.query.metricType || "").trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(METRIC_LIMITS, metricType)) {
    throw new AppError("metricType is required and must be valid", 400, "VALIDATION_ERROR");
  }

  const from = parseOptionalDate(req.query.from, "from");
  const to = parseOptionalDate(req.query.to, "to");
  validateDateRange(from, to);

  const { page, limit, skip } = parsePagination(req.query);

  const filter = {
    patientId,
    metricType,
    ...buildDateRangeQuery("measuredAt", from, to),
  };

  const [items, total] = await Promise.all([
    HealthMetric.find(filter)
      .sort({ measuredAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("metricType value unit measuredAt source")
      .lean(),
    HealthMetric.countDocuments(filter),
  ]);

  return sendResponse(res, 200, true, "Health metric history fetched", {
    items,
    meta: { page, limit, total, metricType },
  });
});

const triggerSosAlert = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const lat = Number(body.location?.lat);
  const lng = Number(body.location?.lng);
  const address = String(body.location?.address || "").trim();
  const message = String(body.message || "").trim();

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new AppError("Invalid latitude", 400, "VALIDATION_ERROR");
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new AppError("Invalid longitude", 400, "VALIDATION_ERROR");
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const [sosCount, contacts] = await Promise.all([
    SOSAlert.countDocuments({ patientId, triggeredAt: { $gte: tenMinutesAgo } }),
    EmergencyContact.find({ patientId }).sort({ priority: 1 }).lean(),
  ]);

  if (sosCount >= 3) {
    throw new AppError("SOS rate limit exceeded. Try again later.", 429, "SOS_RATE_LIMIT");
  }

  if (!contacts.length) {
    throw new AppError("No emergency contacts configured", 409, "EMERGENCY_CONTACTS_MISSING");
  }

  const alert = await SOSAlert.create({
    patientId,
    location: { lat, lng, address },
    message,
    status: "TRIGGERED",
    notifiedContacts: contacts.map((contact) => ({
      contactId: contact._id,
      phone: contact.phone,
      email: contact.email,
      notifiedAt: new Date(),
    })),
    triggeredAt: new Date(),
  });

  return sendResponse(res, 202, true, "SOS alert triggered", {
    alertId: String(alert._id),
    status: alert.status,
    notifiedContacts: contacts.map((contact) => ({
      id: String(contact._id),
      name: contact.name,
      phone: contact.phone,
    })),
  });
});

const bookAppointment = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const doctorId = String(body.doctorId || "").trim();
  const slotStart = new Date(String(body.slotStart || ""));
  const slotEnd = new Date(String(body.slotEnd || ""));
  const reason = String(body.reason || "").trim();

  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw new AppError("Invalid doctorId", 400, "VALIDATION_ERROR");
  }

  if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime()) || slotStart >= slotEnd) {
    throw new AppError("Invalid appointment slot", 400, "VALIDATION_ERROR");
  }

  if (slotStart <= new Date()) {
    throw new AppError("Appointment slot must be in the future", 422, "VALIDATION_ERROR");
  }

  const doctor = await Doctor.findById(doctorId).select("status fullName").lean();
  if (!doctor || String(doctor.status || "").toLowerCase() !== "approved") {
    throw new AppError("Doctor is not available for booking", 404, "DOCTOR_NOT_AVAILABLE");
  }

  const overlap = await Appointment.findOne({
    doctorId,
    status: { $in: BOOKABLE_APPOINTMENT_STATUSES },
    slotStart: { $lt: slotEnd },
    slotEnd: { $gt: slotStart },
  }).lean();

  if (overlap) {
    throw new AppError("Selected slot is no longer available", 409, "APPOINTMENT_SLOT_CONFLICT");
  }

  const appointment = await Appointment.create({
    patientId,
    doctorId,
    slotStart,
    slotEnd,
    reason,
    status: "BOOKED",
  });

  return sendResponse(res, 201, true, "Appointment booked", {
    appointment: {
      id: String(appointment._id),
      doctorId: String(appointment.doctorId),
      slotStart: appointment.slotStart,
      slotEnd: appointment.slotEnd,
      status: appointment.status,
    },
  });
});

const getUpcomingAppointments = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const { page, limit, skip } = parsePagination(req.query);
  const from = parseOptionalDate(req.query.from, "from") || new Date();

  const filter = {
    patientId,
    status: { $in: BOOKABLE_APPOINTMENT_STATUSES },
    slotStart: { $gte: from },
  };

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ slotStart: 1 })
      .skip(skip)
      .limit(limit)
      .populate("doctorId", "fullName specialization clinicAddress")
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return sendResponse(res, 200, true, "Upcoming appointments fetched", {
    items,
    meta: { page, limit, total },
  });
});

const cancelAppointment = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const appointmentId = String(req.params.appointmentId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    throw new AppError("Invalid appointmentId", 400, "VALIDATION_ERROR");
  }

  const reason = String(req.body?.reason || "").trim();
  if (!reason) {
    throw new AppError("Cancellation reason is required", 400, "VALIDATION_ERROR");
  }

  const appointment = await Appointment.findOne({ _id: appointmentId, patientId });
  if (!appointment) {
    throw new AppError("Appointment not found", 404, "APPOINTMENT_NOT_FOUND");
  }

  if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    throw new AppError("Appointment cannot be cancelled", 409, "APPOINTMENT_CANCEL_CONFLICT");
  }

  appointment.status = "CANCELLED";
  appointment.cancellationReason = reason;
  await appointment.save();

  return sendResponse(res, 200, true, "Appointment cancelled", {
    appointment: {
      id: String(appointment._id),
      status: appointment.status,
      cancellationReason: appointment.cancellationReason,
    },
  });
});

const getDoctorsList = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const { page, limit, skip } = parsePagination(req.query);

  const specialty = String(req.query.specialty || "").trim();
  const location = String(req.query.location || "").trim();

  const filter = { status: "Approved" };
  if (specialty) {
    filter.specialization = { $regex: specialty, $options: "i" };
  }

  if (location) {
    filter.clinicAddress = { $regex: location, $options: "i" };
  }

  const [items, total] = await Promise.all([
    Doctor.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("fullName specialization clinicAddress yearsOfExperience generatedId")
      .lean(),
    Doctor.countDocuments(filter),
  ]);

  return sendResponse(res, 200, true, "Doctors fetched", {
    items,
    meta: { page, limit, total },
  });
});

const getReferralDoctors = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const { page, limit, skip } = parsePagination(req.query);
  const specialty = String(req.query.specialty || "").trim();

  const filter = {
    status: "Approved",
    yearsOfExperience: { $gte: 10 },
  };

  if (specialty) {
    filter.specialization = { $regex: specialty, $options: "i" };
  }

  const [items, total] = await Promise.all([
    Doctor.find(filter)
      .sort({ yearsOfExperience: -1 })
      .skip(skip)
      .limit(limit)
      .select("fullName specialization clinicAddress yearsOfExperience generatedId")
      .lean(),
    Doctor.countDocuments(filter),
  ]);

  return sendResponse(res, 200, true, "Referral doctors fetched", {
    items,
    meta: { page, limit, total },
  });
});

const listDiagnosticCenters = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const { page, limit, skip } = parsePagination(req.query);

  const location = String(req.query.location || "").trim();
  const testName = String(req.query.testName || "").trim();

  const filter = { status: "Approved" };
  if (location) {
    filter.$or = [
      { city: { $regex: location, $options: "i" } },
      { centerName: { $regex: location, $options: "i" } },
    ];
  }

  if (testName) {
    filter.testsOffered = { $elemMatch: { $regex: testName, $options: "i" } };
  }

  const [items, total] = await Promise.all([
    DiagnosticsCenter.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("centerName email city testsOffered rating")
      .lean(),
    DiagnosticsCenter.countDocuments(filter),
  ]);

  return sendResponse(res, 200, true, "Diagnostic centers fetched", {
    items,
    meta: { page, limit, total },
  });
});

const bookDiagnosticTest = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const diagnosticCenterId = String(body.diagnosticCenterId || "").trim();
  const testName = String(body.testName || "").trim();
  const notes = String(body.notes || "").trim();
  const slotDateTime = new Date(String(body.slotDateTime || ""));

  if (!mongoose.Types.ObjectId.isValid(diagnosticCenterId)) {
    throw new AppError("Invalid diagnosticCenterId", 400, "VALIDATION_ERROR");
  }

  if (!testName) {
    throw new AppError("testName is required", 400, "VALIDATION_ERROR");
  }

  if (Number.isNaN(slotDateTime.getTime()) || slotDateTime <= new Date()) {
    throw new AppError("slotDateTime must be a valid future datetime", 400, "VALIDATION_ERROR");
  }

  const center = await DiagnosticsCenter.findById(diagnosticCenterId).lean();
  if (!center || String(center.status || "").toLowerCase() !== "approved") {
    throw new AppError("Diagnostic center not available", 404, "DIAGNOSTIC_CENTER_NOT_FOUND");
  }

  if (Array.isArray(center.testsOffered) && center.testsOffered.length) {
    const offered = center.testsOffered.some((item) => String(item).toLowerCase() === testName.toLowerCase());
    if (!offered) {
      throw new AppError("Selected test is not offered by this center", 422, "TEST_NOT_AVAILABLE");
    }
  }

  const booking = await DiagnosticBooking.create({
    patientId,
    diagnosticCenterId,
    testName,
    slotDateTime,
    notes,
    status: "BOOKED",
  });

  return sendResponse(res, 201, true, "Diagnostic test booked", {
    booking: {
      id: String(booking._id),
      status: booking.status,
      slotDateTime: booking.slotDateTime,
      testName: booking.testName,
    },
  });
});

const createEmergencyContact = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = String(body.name || "").trim();
  const relation = String(body.relation || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const priority = Number(body.priority || 1);
  const isPrimary = Boolean(body.isPrimary);

  if (!name || !relation || !phone) {
    throw new AppError("name, relation, and phone are required", 400, "VALIDATION_ERROR");
  }

  if (!Number.isInteger(priority) || priority < 1 || priority > 10) {
    throw new AppError("priority must be an integer between 1 and 10", 400, "VALIDATION_ERROR");
  }

  if (isPrimary) {
    await EmergencyContact.updateMany({ patientId }, { $set: { isPrimary: false } });
  }

  const contact = await EmergencyContact.create({
    patientId,
    name,
    relation,
    phone,
    email,
    priority,
    isPrimary,
  });

  return sendResponse(res, 201, true, "Emergency contact created", {
    contact,
  });
});

const listEmergencyContacts = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const contacts = await EmergencyContact.find({ patientId }).sort({ isPrimary: -1, priority: 1, createdAt: -1 }).lean();

  return sendResponse(res, 200, true, "Emergency contacts fetched", {
    items: contacts,
  });
});

const updateEmergencyContact = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const contactId = String(req.params.contactId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    throw new AppError("Invalid contactId", 400, "VALIDATION_ERROR");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const allowed = ["name", "relation", "phone", "email", "priority", "isPrimary"];
  const updates = {};

  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = field === "email" ? String(body[field] || "").trim().toLowerCase() : body[field];
    }
  }

  if (!Object.keys(updates).length) {
    throw new AppError("No valid contact fields provided", 400, "VALIDATION_ERROR");
  }

  if (updates.isPrimary === true) {
    await EmergencyContact.updateMany({ patientId }, { $set: { isPrimary: false } });
  }

  const contact = await EmergencyContact.findOneAndUpdate(
    { _id: contactId, patientId },
    { $set: updates },
    { new: true }
  ).lean();

  if (!contact) {
    throw new AppError("Emergency contact not found", 404, "EMERGENCY_CONTACT_NOT_FOUND");
  }

  return sendResponse(res, 200, true, "Emergency contact updated", {
    contact,
  });
});

const deleteEmergencyContact = asyncHandler(async (req, res) => {
  const patientId = resolvePatientId(req);
  await ensurePatientExists(patientId);

  const contactId = String(req.params.contactId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    throw new AppError("Invalid contactId", 400, "VALIDATION_ERROR");
  }

  const removed = await EmergencyContact.findOneAndDelete({ _id: contactId, patientId }).lean();
  if (!removed) {
    throw new AppError("Emergency contact not found", 404, "EMERGENCY_CONTACT_NOT_FOUND");
  }

  return sendResponse(res, 200, true, "Emergency contact deleted", {
    id: contactId,
  });
});

module.exports = {
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
};
