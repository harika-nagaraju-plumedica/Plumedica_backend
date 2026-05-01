const mongoose = require("mongoose");
const AppError = require("./AppError");

const assertObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid resource id", 400);
  }
};

module.exports = {
  assertObjectId,
};
