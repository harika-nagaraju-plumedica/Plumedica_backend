# PluMedica Backend API

Production-ready Node.js + Express + MongoDB backend for Flutter registration modules.

## Tech Stack
- Node.js
- Express.js
- MongoDB + Mongoose
- Multer (local file uploads)
- dotenv

## Folder Structure

```text
plumedica_backend/
  config/
    db.js
  controllers/
    diagnostics/
      diagnosticsController.js
    doctor/
      doctorController.js
    employer/
      employerController.js
    hospital/
      hospitalController.js
    jobSeeker/
      jobSeekerController.js
    partner/
      partnerController.js
    patient/
      patientController.js
    pharmacy/
      pharmacyController.js
  middleware/
    errorHandler.js
    upload.js
  models/
    DiagnosticsCenter.js
    Doctor.js
    Employer.js
    Hospital.js
    JobSeeker.js
    PartnerOrganization.js
    Patient.js
    Pharmacy.js
    User.js
  routes/
    diagnostics/
      diagnosticsRoutes.js
    doctor/
      doctorRoutes.js
    employer/
      employerRoutes.js
    hospital/
      hospitalRoutes.js
    jobSeeker/
      jobSeekerRoutes.js
    partner/
      partnerRoutes.js
    patient/
      patientRoutes.js
    pharmacy/
      pharmacyRoutes.js
    auth.js
  uploads/
    .gitkeep
  utils/
    apiResponse.js
    AppError.js
    asyncHandler.js
    mongo.js
    validation.js
  .env.example
  .gitignore
  index.js
  package.json
  server.js
```

## Install Packages

```bash
npm install
```

Already included dependencies:
- express
- mongoose
- cors
- dotenv
- bcryptjs
- multer
- nodemon

## Environment Variables
Create a `.env` file:

```env
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/plumedica
JWT_SECRET=replace-with-strong-secret

# SMTP (required for approval/rejection emails)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey-or-username
SMTP_PASS=smtp-password
SMTP_FROM=no-reply@plumedica.com
APPROVAL_FROM_EMAIL=info@plumedica.com
```

## Run Locally

```bash
npm run dev
```

```bash
npm start
```

## Base URL
- Local: `http://localhost:5000`

## Common Response Format

```json
{
  "success": true,
  "message": "",
  "data": {}
}
```

## API Endpoints (Individual Modules)

### Doctor
- POST `/api/doctors`
- GET `/api/doctors`
- GET `/api/doctors/:id`
- PUT `/api/doctors/:id`
- DELETE `/api/doctors/:id`

POST form-data fields:
- fullName (required)
- email (required)
- mobileNumber (required)
- password (required)
- qualification (required)
- specialization (optional)
- yearOfGraduation (required)
- yearsOfExperience (required)
- clinicAddress (required)
- medicalLicenseNumber (required)
- medicalLicenseDocument (file)
- availabilitySlots (required JSON string)

Example `availabilitySlots`:
```json
[
  {
    "day": "Monday",
    "slots": [
      { "startTime": "09:00", "endTime": "13:00" },
      { "startTime": "17:00", "endTime": "20:00" }
    ]
  }
]
```

### Pharmacy
- POST `/api/pharmacies`
- GET `/api/pharmacies`
- GET `/api/pharmacies/:id`
- PUT `/api/pharmacies/:id`
- DELETE `/api/pharmacies/:id`

POST form-data fields:
- legalPharmacyName (required)
- state (required)
- city (required)
- phoneNumber (required)
- gstNumber (required)
- hasDrugLicense (boolean)
- gstCertificate (required file)
- drugLicense (optional file)

### Patient
- POST `/api/patients`
- GET `/api/patients`
- GET `/api/patients/:id`
- PUT `/api/patients/:id`
- DELETE `/api/patients/:id`

POST JSON:
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "gender": "Male",
  "bloodGroup": "O+",
  "address": "Bangalore"
}
```

### Hospital
- POST `/api/hospitals`
- GET `/api/hospitals`
- GET `/api/hospitals/:id`
- PUT `/api/hospitals/:id`
- DELETE `/api/hospitals/:id`

POST form-data fields:
- hospitalName (required)
- state (required)
- city (required)
- gstNumber (required)
- ceRegistrationNumber (required)
- email (required)
- mobile (required)
- address (required)
- gstCertificate (required file)
- ceLicense (required file)

### Diagnostics Center
- POST `/api/diagnostics-centers`
- GET `/api/diagnostics-centers`
- GET `/api/diagnostics-centers/:id`
- PUT `/api/diagnostics-centers/:id`
- DELETE `/api/diagnostics-centers/:id`

POST JSON:
```json
{
  "centerName": "City Diagnostics",
  "email": "diagnostics@example.com",
  "password": "secret123"
}
```

### Partner Organization
- POST `/api/partner-organizations`
- GET `/api/partner-organizations`
- GET `/api/partner-organizations/:id`
- PUT `/api/partner-organizations/:id`
- DELETE `/api/partner-organizations/:id`

POST JSON:
```json
{
  "organizationName": "Health Insurance Co.",
  "email": "partner@example.com",
  "mobile": "9876543210",
  "licenseNumber": "LIC-2024-UIN-001"
}
```

### Job Seeker
- POST `/api/job-seekers`
- GET `/api/job-seekers`
- GET `/api/job-seekers/:id`
- PUT `/api/job-seekers/:id`
- DELETE `/api/job-seekers/:id`

POST JSON:
```json
{
  "fullName": "John Seeker",
  "email": "john.seeker@email.com",
  "phone": "9876543210",
  "experience": "3 years"
}
```

### Employer
- POST `/api/employers`
- GET `/api/employers`
- GET `/api/employers/:id`
- PUT `/api/employers/:id`
- DELETE `/api/employers/:id`

POST JSON:
```json
{
  "companyName": "Acme Pvt Ltd",
  "email": "hr@acme.com"
}
```

## Postman Usage Tips
- For file endpoints, choose `form-data` and set document fields to `File` type.
- For JSON endpoints, set `Content-Type: application/json`.
- Use IDs from list APIs for get-by-id, update, and delete calls.

## Render Deployment Ready Notes
- Uses `process.env.PORT` automatically.
- Uses `process.env.MONGO_URI` for DB connection.
- Static uploads served from `/uploads`.
- Start command on Render: `npm start`
