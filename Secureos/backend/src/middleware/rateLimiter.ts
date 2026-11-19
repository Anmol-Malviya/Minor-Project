import { rateLimit } from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

/**
 * Rate limiter for public enquiry submissions (FR-ENQ-007, SRS 10.2).
 * Restricts an IP to 10 submissions per 15 minutes.
 */
export const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message:
      "Too many enquiry submissions from this IP. Please try again after 15 minutes.",
  },
});

/**
 * Rate limiter for Cloudinary upload authorization requests (SRS 10.2).
 * Restricts an IP to 50 signature requests per 15 minutes.
 */
export const uploadSignatureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Too many upload requests. Please try again later.",
  },
});

/**
 * General rate limiter for standard public API endpoints (SRS 10.2).
 * Restricts an IP to 300 requests per 15 minutes.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
});
