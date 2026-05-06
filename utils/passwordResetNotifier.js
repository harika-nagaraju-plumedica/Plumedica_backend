const nodemailer = require("nodemailer");
const twilio = require("twilio");

let cachedEmailTransporter = null;

const isEmailConfigured = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
};

const getEmailTransporter = () => {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!cachedEmailTransporter) {
    cachedEmailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return cachedEmailTransporter;
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
  const transporter = getEmailTransporter();
  const message = buildResetMessage({ moduleKey, token, expiresInMinutes });

  if (!transporter) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[password-reset] email fallback", { to, ...message });
      return { delivered: true, provider: "console" };
    }

    return { delivered: false, provider: "smtp", reason: "SMTP_NOT_CONFIGURED" };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: message.subject,
    text: message.text,
  });

  return { delivered: true, provider: "smtp" };
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
