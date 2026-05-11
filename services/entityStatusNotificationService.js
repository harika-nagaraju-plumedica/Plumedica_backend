const nodemailer = require("nodemailer");
const EntityStatusEmailLog = require("../models/EntityStatusEmailLog");

let cachedTransporter = null;

const isSmtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
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

const buildApprovalBody = ({ recipientName, entityLabel, nextSteps }) => {
  const appName = process.env.APP_NAME || "PluMedica";
  const safeName = recipientName || "User";
  const lines = [
    `Hello ${safeName},`,
    "",
    `Your ${entityLabel} request has been approved.`,
    "You can now access approved features in your account.",
  ];

  if (nextSteps) {
    lines.push("", `Next steps: ${nextSteps}`);
  }

  lines.push("", `Regards,`, `${appName} Team`);
  return lines.join("\n");
};

const buildRejectionBody = ({ recipientName, entityLabel, rejectionReason }) => {
  const appName = process.env.APP_NAME || "PluMedica";
  const safeName = recipientName || "User";
  const lines = [
    `Hello ${safeName},`,
    "",
    `Your ${entityLabel} request has been rejected.`,
    "Please review your submitted information and contact support if you need assistance.",
  ];

  if (rejectionReason) {
    lines.push("", `Reason: ${rejectionReason}`);
  }

  lines.push("", `Regards,`, `${appName} Team`);
  return lines.join("\n");
};

const sendEntityStatusNotification = async ({
  entityKey,
  recordId,
  to,
  recipientName,
  entityLabel,
  status,
  rejectionReason,
  nextSteps,
}) => {
  const transporter = getTransporter();
  const isApproved = status === "Approved";
  const maxRetries = Math.max(Number(process.env.ENTITY_STATUS_EMAIL_MAX_RETRIES || 1), 1);

  const subject = isApproved ? "Your Request Has Been Approved" : "Your Request Has Been Rejected";
  const text = isApproved
    ? buildApprovalBody({ recipientName, entityLabel, nextSteps })
    : buildRejectionBody({ recipientName, entityLabel, rejectionReason });

  const writeLog = async ({ deliveryStatus, provider, attempts, errorMessage }) => {
    try {
      if (!entityKey || !recordId) {
        return;
      }

      await EntityStatusEmailLog.create({
        entityKey,
        recordId,
        to,
        recipientName,
        entityLabel,
        status,
        subject,
        provider,
        deliveryStatus,
        attempts,
        errorMessage,
      });
    } catch (logError) {
      console.error("[entity-status-notification] failed to persist email log", {
        entityKey,
        recordId: String(recordId || ""),
        to,
        status,
        error: logError?.message || logError,
      });
    }
  };

  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[entity-status-notification] email fallback", { to, subject, text });
      await writeLog({
        deliveryStatus: "sent",
        provider: "console",
        attempts: 1,
        errorMessage: "",
      });
      return { delivered: true, provider: "console" };
    }

    await writeLog({
      deliveryStatus: "failed",
      provider: "smtp",
      attempts: 0,
      errorMessage: "SMTP_NOT_CONFIGURED",
    });
    return { delivered: false, provider: "smtp", reason: "SMTP_NOT_CONFIGURED" };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
      });

      await writeLog({
        deliveryStatus: "sent",
        provider: "smtp",
        attempts: attempt,
        errorMessage: "",
      });

      return { delivered: true, provider: "smtp", attempts: attempt };
    } catch (error) {
      lastError = error;
      console.error("[entity-status-notification] email attempt failed", {
        to,
        status,
        attempt,
        maxRetries,
        timestamp: new Date().toISOString(),
        error: error?.message || error,
      });
    }
  }

  await writeLog({
    deliveryStatus: "failed",
    provider: "smtp",
    attempts: maxRetries,
    errorMessage: lastError?.message || "UNKNOWN_EMAIL_DELIVERY_ERROR",
  });

  throw lastError;
};

module.exports = {
  sendEntityStatusNotification,
};
