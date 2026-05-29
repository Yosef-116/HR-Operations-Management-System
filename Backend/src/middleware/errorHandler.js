const AppError = require('../utils/AppError');

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const payload = {
    success: false,
    message: statusCode >= 500 ? 'Internal server error' : error.message
  };

  if (error.details) payload.details = error.details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    payload.error = error.message;
    payload.stack = error.stack;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json(payload);
};

module.exports = {
  notFound,
  errorHandler
};
