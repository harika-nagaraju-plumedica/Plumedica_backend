const PasswordResetToken = require("../models/PasswordResetToken");
const PasswordResetRequestLog = require("../models/PasswordResetRequestLog");

const createResetToken = async (payload) => PasswordResetToken.create(payload);

const findActiveTokenByHash = async ({ moduleKey, tokenHash }) => {
  return PasswordResetToken.findOne({
    moduleKey,
    tokenHash,
    usedAt: null,
  });
};

const markTokenUsed = async (tokenId) => {
  return PasswordResetToken.findByIdAndUpdate(tokenId, { usedAt: new Date() }, { new: true });
};

const deleteActiveTokensForUser = async ({ moduleKey, userId }) => {
  return PasswordResetToken.deleteMany({
    moduleKey,
    userId,
    usedAt: null,
  });
};

const recordForgotPasswordRequest = async ({ moduleKey, identifierHash, ipHash, expiresAt }) => {
  return PasswordResetRequestLog.create({ moduleKey, identifierHash, ipHash, expiresAt });
};

const countForgotPasswordRequests = async ({ moduleKey, identifierHash, ipHash, since }) => {
  return PasswordResetRequestLog.countDocuments({
    moduleKey,
    identifierHash,
    ipHash,
    createdAt: { $gte: since },
  });
};

module.exports = {
  createResetToken,
  findActiveTokenByHash,
  markTokenUsed,
  deleteActiveTokensForUser,
  recordForgotPasswordRequest,
  countForgotPasswordRequests,
};
