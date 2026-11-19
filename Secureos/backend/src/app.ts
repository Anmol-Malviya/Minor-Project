import express from "express";
import cors from "cors";
import helmet from "helmet";
import { clerkMiddleware } from "@clerk/express";

import healthRouter from "./routes/health.routes";
import propertyRoutes from "./routes/property.routes";
import enquiryRoutes from "./routes/enquiry.routes";
import settingsRoutes from "./routes/settings.routes";
import partnerRoutes from "./routes/partner.routes";
import meRoutes from "./routes/me.routes";
import adminRoutes from "./routes/admin.routes";
import { errorHandler } from "./middleware/errorHandler";
import { generalLimiter } from "./middleware/rateLimiter";

const app = express();

// Trust proxy header for load balancers / reverse proxies in production (Render, Railway, Cloudflare, AWS)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS configuration supporting single or comma-separated origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

// Parse JSON request bodies
app.use(express.json());

// Clerk authentication middleware (active when Clerk keys are present)
const isClerkConfigured = Boolean(
  process.env.CLERK_PUBLISHABLE_KEY || process.env.CLERK_SECRET_KEY
);

if (isClerkConfigured) {
  app.use(clerkMiddleware());
} else {
  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "Warning: Clerk keys are not set in environment. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable live authentication."
    );
  }
}

// Apply general rate limiting across API endpoints (SRS 10.2)
app.use("/api", generalLimiter);

// API Routes
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/properties", propertyRoutes);
app.use("/api/v1/enquiries", enquiryRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/partners", partnerRoutes);
app.use("/api/v1/me", meRoutes);
app.use("/api/v1/admin", adminRoutes);

// Centralized error handling middleware
app.use(errorHandler);

export default app;
