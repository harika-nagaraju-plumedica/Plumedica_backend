const nodemailer = require("nodemailer");

let cachedTransporter = null;
const DEFAULT_APPROVAL_FROM_EMAIL = "harika.nagaraju@plumedica.com";

const getFromAddress = () => {
  const fromEmail = String(
    process.env.APPROVAL_FROM_EMAIL || process.env.SMTP_FROM || DEFAULT_APPROVAL_FROM_EMAIL
  ).trim();
  const fromName = String(process.env.APP_NAME || "PluMedica").trim();
  return `${fromName} <${fromEmail}>`;
};

const isSmtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
};

const getTransporter = () => {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return cachedTransporter;
};

const toTitleCase = (value = "") => {
  return String(value)
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const sendApprovalIdEmail = async ({ to, recipientName, role, generatedId }) => {
  const safeTo = String(to || "").trim();
  const safeId = String(generatedId || "").trim();

  if (!safeTo || !safeId) {
    return { delivered: false, provider: "none", reason: "MISSING_EMAIL_OR_ID" };
  }

  const roleTitle = toTitleCase(role || "user");
  const appName = process.env.APP_NAME || "PluMedica";
  const subject = `${roleTitle} Approval Successful`;
  const text = [
    `Hello ${recipientName || "User"},`,
    "",
    `Your ${roleTitle} account has been approved.`,
    `Your unique ID is: ${safeId}`,
    "",
    "Please keep this ID safe for future reference.",
    "",
    `Regards,`,
    `${appName} Team`,
  ].join("\n");

  const transporter = getTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[approval-id-email] email fallback", { to: safeTo, subject, text });
      return { delivered: true, provider: "console" };
    }

    return { delivered: false, provider: "smtp", reason: "SMTP_NOT_CONFIGURED" };
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to: safeTo,
    subject,
    text,
  });

  return { delivered: true, provider: "smtp" };
};

module.exports = {
  sendApprovalIdEmail,
};
