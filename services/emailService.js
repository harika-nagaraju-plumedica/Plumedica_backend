const sgMail = require("@sendgrid/mail");

const SENDER_EMAIL = "chakanamanikantaplumedica@gmail.com";

const sendApprovalEmail = async (user) => {
  const payload = user && typeof user === "object" ? user : {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const generatedId = String(payload.generatedId || "").trim();
  const password = String(payload.password || "").trim();

  if (!name || !email || !generatedId || !password) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!email) missingFields.push("email");
    if (!generatedId) missingFields.push("generatedId");
    if (!password) missingFields.push("password");

    const reason = "MISSING_FIELDS:" + missingFields.join(",");
    console.error("[send-approval-email] invalid payload", { email, reason });
    return {
      delivered: false,
      provider: "sendgrid",
      reason,
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

  const text = [
    "Hello " + name + ", your registration has been APPROVED.",
    "Your ID: " + generatedId,
    "Your Password: " + password,
  ].join("\n");

  try {
    await sgMail.send({
      to: email,
      from: SENDER_EMAIL,
      subject: "Plumedica Status Update",
      text,
    });

    console.info("[send-approval-email] email sent", {
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
    const parsedError = {
      message: String(error?.message || "Unknown SendGrid error"),
      statusCode: Number(error?.response?.statusCode || 0) || null,
      code: String(error?.code || "SENDGRID_ERROR"),
    };

    console.error("[send-approval-email] failed", {
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
