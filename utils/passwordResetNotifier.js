const sgMail = require("@sendgrid/mail");
const twilio = require("twilio");

const DEFAULT_FROM_EMAIL = "info@plumedica.com";

const getFromAddress = () => {
  const fromEmail = String(
    process.env.APPROVAL_FROM_EMAIL || DEFAULT_FROM_EMAIL
  ).trim();
  const fromName = String(process.env.APP_NAME || "PluMedica").trim();
  return `${fromName} <${fromEmail}>`;
};

const hasFromAddress = () => {
  return Boolean(String(process.env.APPROVAL_FROM_EMAIL || DEFAULT_FROM_EMAIL).trim());
};

const isEmailConfigured = () => {
  return Boolean(String(process.env.SENDGRID_API_KEY || "").trim() && hasFromAddress());
};

const isSmsConfigured = () => {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
};

const buildResetMessage = ({ moduleKey, token, expiresInMinutes }) => {
  const appName = process.env.APP_NAME || "PluMedica";
  return {
    subject: `${appName} password reset`,
    text: `A password reset was requested for your ${moduleKey} account. Use this token: ${token}. It expires in ${expiresInMinutes} minutes. If you did not request this, ignore this message.`,
  };
};

const sendEmailResetInstructions = async ({ to, moduleKey, token, expiresInMinutes }) => {
  const message = buildResetMessage({ moduleKey, token, expiresInMinutes });

  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[password-reset] email fallback", { to, ...message });
      return { delivered: true, provider: "console" };
    }

    return { delivered: false, provider: "sendgrid", reason: "SENDGRID_API_KEY_MISSING" };
  }

  sgMail.setApiKey(String(process.env.SENDGRID_API_KEY || "").trim());
  await sgMail.send({
    from: getFromAddress(),
    to,
    subject: message.subject,
    text: message.text,
  });

  return { delivered: true, provider: "sendgrid" };
};

const sendSmsResetInstructions = async ({ to, moduleKey, token, expiresInMinutes }) => {
  const message = buildResetMessage({ moduleKey, token, expiresInMinutes });

  if (!isSmsConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[password-reset] sms fallback", { to, text: message.text });
      return { delivered: true, provider: "console" };
    }

    return { delivered: false, provider: "twilio", reason: "TWILIO_NOT_CONFIGURED" };
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to,
    body: message.text,
  });

  return { delivered: true, provider: "twilio" };
};

module.exports = {
  sendEmailResetInstructions,
  sendSmsResetInstructions,
};
