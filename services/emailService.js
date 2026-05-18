const sgMail = require("@sendgrid/mail");

const SENDER_EMAIL = "chakanamanikantaplumedica@gmail.com";

const sendStatusEmail = async (user, status, reason = "") => {
  const payload = user && typeof user === "object" ? user : {};
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const generatedId = String(payload.generatedId || "").trim();
  const password = String(payload.password || "").trim();
  const rejectionReason = String(reason || "").trim();
  const loginLink = String(process.env.APP_LOGIN_URL || "https://your-app-link.com").trim();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const isApproved = normalizedStatus === "approved";
  const isRejected = normalizedStatus === "rejected";

  if (!isApproved && !isRejected) {
    const reason = "INVALID_STATUS";
    console.error("[send-status-email] invalid status", { email, reason, status });
    return {
      delivered: false,
      provider: "sendgrid",
      reason,
      recipientEmail: email,
    };
  }

  if (!name || !email) {
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!email) missingFields.push("email");

    const reason = "MISSING_FIELDS:" + missingFields.join(",");
    console.error("[send-status-email] invalid payload", { email, reason });
    return {
      delivered: false,
      provider: "sendgrid",
      reason,
      recipientEmail: email,
    };
  }

  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[send-status-email] SENDGRID_API_KEY is not configured");
    return {
      delivered: false,
      provider: "sendgrid",
      reason: "SENDGRID_API_KEY_MISSING",
      recipientEmail: email,
    };
  }

  sgMail.setApiKey(apiKey);

  const subject = "Plumedica Status Update";
  const text = isApproved
    ? [
        "Hello " + name + ",",
        "",
        "Your registration is APPROVED.",
        "",
        generatedId ? "Your ID: " + generatedId : "",
        password ? "Your Password: " + password : "",
        "",
        "Login: " + loginLink,
      ].join("\n")
    : [
        "Hello " + name + ",",
        "",
        "Your registration is REJECTED.",
        "",
        "Reason: " + (rejectionReason || "Not specified"),
        "",
        "Please contact support.",
      ].join("\n");

  try {
    await sgMail.send({
      to: email,
      from: SENDER_EMAIL,
      subject,
      text: text
        .split("\n")
        .filter(Boolean)
        .join("\n"),
    });

    console.info("[send-status-email] email sent", {
      recipientEmail: email,
      status: isApproved ? "Approved" : "Rejected",
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
      body: error?.response?.body || null,
    };

    console.error("[send-status-email] failed", {
      recipientEmail: email,
      status: isApproved ? "Approved" : "Rejected",
      error: error?.response?.body || error?.message,
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
  sendStatusEmail,
};
