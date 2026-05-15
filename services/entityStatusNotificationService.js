const sgMail = require("@sendgrid/mail");
const EntityStatusEmailLog = require("../models/EntityStatusEmailLog");

const DEFAULT_APPROVAL_FROM_EMAIL = "info@plumedica.com";

const getFromAddress = () => {
  const fromEmail = String(
    process.env.APPROVAL_FROM_EMAIL || DEFAULT_APPROVAL_FROM_EMAIL
  ).trim();
  const fromName = String(process.env.APP_NAME || "PluMedica").trim();
  return `${fromName} <${fromEmail}>`;
};

const isSendGridConfigured = () => {
  return Boolean(String(process.env.SENDGRID_API_KEY || "").trim());
};

const getMissingSendGridKeys = () => {
  const required = ["SENDGRID_API_KEY"];
  return required.filter((key) => !String(process.env[key] || "").trim());
};

const getSendGridConfigSummary = () => {
  return {
    hasApiKey: Boolean(String(process.env.SENDGRID_API_KEY || "").trim()),
    from: getFromAddress(),
  };
};

const sanitizeEmailError = (error) => {
  const responseBody = error?.response?.body;
  const details = Array.isArray(responseBody?.errors)
    ? responseBody.errors.map((entry) => ({
        message: String(entry?.message || ""),
        field: String(entry?.field || ""),
      }))
    : [];

  return {
    code: String(error?.code || "SENDGRID_ERROR"),
    responseCode: Number(error?.response?.statusCode || 0) || null,
    command: "sendgrid.send",
    message: String(error?.message || "Unknown email delivery error"),
    details,
  };
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
  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  if (apiKey) {
    sgMail.setApiKey(apiKey);
  }

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

  if (!apiKey) {
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
      provider: "sendgrid",
      attempts: 0,
      errorMessage: "SENDGRID_API_KEY_MISSING",
    });
    return { delivered: false, provider: "sendgrid", reason: "SENDGRID_API_KEY_MISSING" };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await sgMail.send({
        from: getFromAddress(),
        to,
        subject,
        text,
      });

      await writeLog({
        deliveryStatus: "sent",
        provider: "sendgrid",
        attempts: attempt,
        errorMessage: "",
      });

      return { delivered: true, provider: "sendgrid", attempts: attempt };
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

const debugEntityStatusEmailDelivery = async ({ to } = {}) => {
  const diagnostics = {
    sendGridConfigured: isSendGridConfigured(),
    missingKeys: getMissingSendGridKeys(),
    config: getSendGridConfigSummary(),
  };

  if (!diagnostics.sendGridConfigured) {
    return {
      ok: false,
      stage: "configuration",
      diagnostics,
      error: {
        code: "SENDGRID_API_KEY_MISSING",
        responseCode: null,
        command: "sendgrid.send",
        message: "SENDGRID_API_KEY is not configured.",
      },
    };
  }

  const safeTo = String(to || "").trim();
  if (!safeTo) {
    return {
      ok: true,
      stage: "configuration",
      diagnostics,
      message: "SendGrid is configured. Provide a recipient to send a test email.",
    };
  }

  const subject = "PluMedica Email Delivery Test";
  const text = [
    "Hello,",
    "",
    "This is a test email from PluMedica admin diagnostics.",
    "If you received this, SMTP delivery is working.",
  ].join("\n");

  try {
    sgMail.setApiKey(String(process.env.SENDGRID_API_KEY || "").trim());
    const [info] = await sgMail.send({
      from: getFromAddress(),
      to: safeTo,
      subject,
      text,
    });

    return {
      ok: true,
      stage: "send",
      diagnostics,
      messageId: String(info?.headers?.["x-message-id"] || info?.headers?.["X-Message-Id"] || ""),
      accepted: [safeTo],
      rejected: [],
      response: String(info?.statusCode || ""),
    };
  } catch (error) {
    return {
      ok: false,
      stage: "send",
      diagnostics,
      error: sanitizeEmailError(error),
    };
  }
};

module.exports = {
  sendEntityStatusNotification,
  debugEntityStatusEmailDelivery,
};
