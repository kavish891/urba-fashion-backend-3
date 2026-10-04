const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // Mongoose Bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found with id: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((val) => val.message);
  }

  // Never expose raw internal errors / stack traces in production
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: err.message || (statusCode === 500 ? 'An unexpected error occurred on the server.' : message),
    errors,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
