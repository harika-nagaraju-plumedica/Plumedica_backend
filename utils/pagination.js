const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const toPositiveInt = (value, fallback) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }

  return number;
};

const parsePagination = (query = {}) => {
  const page = toPositiveInt(query.page, DEFAULT_PAGE);
  const rawLimit = toPositiveInt(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

module.exports = {
  parsePagination,
  MAX_LIMIT,
};
