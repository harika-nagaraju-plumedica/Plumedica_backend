const sgMail = require("@sendgrid/mail");

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

  if (!isSendGridConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[approval-id-email] email fallback", { to: safeTo, subject, text });
      return { delivered: true, provider: "console" };
    }

    return { delivered: false, provider: "sendgrid", reason: "SENDGRID_API_KEY_MISSING" };
  }

  sgMail.setApiKey(String(process.env.SENDGRID_API_KEY || "").trim());
  await sgMail.send({
    from: getFromAddress(),
    to: safeTo,
    subject,
    text,
  });

  return { delivered: true, provider: "sendgrid" };
};

module.exports = {
  sendApprovalIdEmail,
};
