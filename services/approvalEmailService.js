const sgMail = require("@sendgrid/mail");

const APPROVAL_SENDER_EMAIL = "chakanamanikantaplumedica@gmail.com";
const DEFAULT_LOGIN_LINK = "https://plumedica.com/login";

const parseSendGridError = (error) => {
  const responseBody = error?.response?.body;
  const details = Array.isArray(responseBody?.errors)
    ? responseBody.errors.map((entry) => ({
        message: String(entry?.message || ""),
        field: String(entry?.field || ""),
        help: String(entry?.help || ""),
      }))
    : [];

  return {
    message: String(error?.message || "Unknown SendGrid error"),
    code: String(error?.code || "SENDGRID_ERROR"),
    statusCode: Number(error?.code || 0) || Number(error?.response?.statusCode || 0) || null,
    details,
  };
};

const buildHtmlBody = ({ name, generatedId, password, loginLink }) => {
  return [
    `<p>Hello ${name},</p>`,
    "<p>Your account has been approved by Plumedica admin.</p>",
    "<p><strong>Account details:</strong></p>",
    `<ul>`,
    `<li><strong>User Name:</strong> ${name}</li>`,
    `<li><strong>Generated ID:</strong> ${generatedId}</li>`,
    `<li><strong>Password:</strong> ${password}</li>`,
    `<li><strong>Login Link:</strong> <a href=\"${loginLink}\">${loginLink}</a></li>`,
    `</ul>`,
    "<p>Please change your password after your first login.</p>",
    "<p>Regards,<br/>Plumedica Team</p>",
  ].join("");
};

const buildTextBody = ({ name, generatedId, password, loginLink }) => {
  return [
    `Hello ${name},`,
    "",
    "Your account has been approved by Plumedica admin.",
    "",
    "Account details:",
    `User Name: ${name}`,
    `Generated ID: ${generatedId}`,
    `Password: ${password}`,
    `Login Link: ${loginLink}`,
    "",
    "Please change your password after your first login.",
    "",
    "Regards,",
    "Plumedica Team",
  ].join("\n");
};

const sendApprovalEmail = async (user) => {
  const payload = user && typeof user === "object" ? user : {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const generatedId = String(payload.generatedId || "").trim();
  const password = String(payload.password || "").trim();
  const loginLink = String(
    payload.loginLink || process.env.APP_LOGIN_URL || process.env.FRONTEND_LOGIN_URL || DEFAULT_LOGIN_LINK
  ).trim();

  const missingFields = [];
  if (!name) missingFields.push("name");
  if (!email) missingFields.push("email");
  if (!generatedId) missingFields.push("generatedId");
  if (!password) missingFields.push("password");

  if (missingFields.length) {
    console.error("[send-approval-email] missing required user fields", {
      email,
      missingFields,
    });

    return {
      delivered: false,
      provider: "sendgrid",
      reason: `MISSING_FIELDS:${missingFields.join(",")}`,
      recipientEmail: email,
    };
  }

  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[send-approval-email] SENDGRID_API_KEY is not configured");
    return {
      delivered: false,
      provider: "sendgrid",
      reason: "SENDGRID_API_KEY_MISSING",
      recipientEmail: email,
    };
  }

  sgMail.setApiKey(apiKey);

  const message = {
    to: email,
    from: APPROVAL_SENDER_EMAIL,
    subject: "Your Plumedica Account Is Approved",
    text: buildTextBody({ name, generatedId, password, loginLink }),
    html: buildHtmlBody({ name, generatedId, password, loginLink }),
  };

  try {
    await sgMail.send(message);
    console.info("[send-approval-email] approval email sent", {
      recipientEmail: email,
      generatedId,
    });

    return {
      delivered: true,
      provider: "sendgrid",
      reason: "",
      recipientEmail: email,
    };
  } catch (error) {
    const parsedError = parseSendGridError(error);
    console.error("[send-approval-email] failed to send approval email", {
      recipientEmail: email,
      generatedId,
      error: parsedError,
    });

    return {
      delivered: false,
      provider: "sendgrid",
      reason: parsedError.code,
      recipientEmail: email,
      error: parsedError,
    };
  }
};

module.exports = {
  sendApprovalEmail,
};
