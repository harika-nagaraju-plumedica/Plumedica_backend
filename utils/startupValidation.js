const AppError = require("./AppError");

const hasAllValues = (values = []) => values.every((value) => String(value || "").trim().length > 0);
const hasAnyValue = (values = []) => values.some((value) => String(value || "").trim().length > 0);

const validateChannel = ({ name, values, requiredKeys }) => {
  const anyPresent = hasAnyValue(values);
  const allPresent = hasAllValues(values);

  if (anyPresent && !allPresent) {
    const missing = requiredKeys.filter((key, index) => !String(values[index] || "").trim());
    throw new AppError(
      `${name} config is incomplete. Missing: ${missing.join(", ")}`,
      500,
      "INVALID_STARTUP_CONFIGURATION"
    );
  }

  return allPresent;
};

const validateStartupConfig = () => {
  const strictResetDelivery = String(process.env.PASSWORD_RESET_REQUIRE_DELIVERY || "false").toLowerCase() === "true";

  if (!strictResetDelivery) {
    return true;
  }

  const smtpValues = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
    process.env.SMTP_PASS,
    process.env.SMTP_FROM,
  ];

  const twilioValues = [
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
    process.env.TWILIO_FROM_NUMBER,
  ];

  const smtpConfigured = validateChannel({
    name: "SMTP",
    values: smtpValues,
    requiredKeys: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
  });

  const twilioConfigured = validateChannel({
    name: "Twilio",
    values: twilioValues,
    requiredKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
  });

  if (!smtpConfigured && !twilioConfigured) {
    throw new AppError(
      "Password reset delivery is required but no provider is configured. Configure SMTP and/or Twilio.",
      500,
      "INVALID_STARTUP_CONFIGURATION"
    );
  }

  return true;
};

module.exports = {
  validateStartupConfig,
};
