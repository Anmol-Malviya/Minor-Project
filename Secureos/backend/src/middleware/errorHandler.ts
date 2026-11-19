import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues,
    });
    return;
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err?.name === "CastError") {
    res.status(400).json({
      success: false,
      message: `Invalid value for ${err.path}: ${err.value}`,
    });
    return;
  }

  // Handle Mongoose ValidationError
  if (err?.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: "Database validation error",
      errors: err.errors,
    });
    return;
  }

  // Handle Mongo Duplicate Key Error (11000)
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "record";
    res.status(409).json({
      success: false,
      message: `A ${field} with this value already exists`,
    });
    return;
  }

  // Safe server error response (never leak stack trace in production)
  console.error("Server error:", err);
  const statusCode = typeof err?.status === "number" ? err.status : 500;
  res.status(statusCode).json({
    success: false,
    message: err?.message || "Internal server error",
  });
};

