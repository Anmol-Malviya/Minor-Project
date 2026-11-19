import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { AuthContext, UserRole } from "../types/auth";
import { sendError } from "../utils/apiResponse";

/**
 * Extracts and determines user role from session claims and environment override.
 */
export const extractRole = (
  userId: string,
  claims?: Record<string, unknown> | null
): UserRole => {
  // If explicitly configured as initial admin via environment variable
  const initialAdminId = process.env.INITIAL_ADMIN_CLERK_ID?.trim();
  if (initialAdminId && userId === initialAdminId) {
    return "ADMIN";
  }

  // Check claims metadata (Clerk user public metadata)
  const metadata = (claims?.metadata ||
    claims?.public_metadata ||
    claims?.publicMetadata) as Record<string, unknown> | undefined;

  const role = metadata?.role;
  if (typeof role === "string" && role.toUpperCase() === "ADMIN") {
    return "ADMIN";
  }

  return "USER";
};

/**
 * Optional authentication middleware:
 * If a valid Clerk token is present, populates res.locals.auth.
 * If no token or invalid token, continues execution as guest (res.locals.auth remains undefined).
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const auth = getAuth(req);
    if (auth?.userId) {
      const claims = auth.sessionClaims as Record<string, unknown> | null;
      const role = extractRole(auth.userId, claims);

      res.locals.auth = {
        clerkUserId: auth.userId,
        role,
        claims: claims || undefined,
      };
    }
  } catch (error) {
    // Guest access fallback - do not block request
    console.debug("Optional auth check passed with no session:", error);
  }
  next();
};

/**
 * Required authentication middleware:
 * Requires a verified Clerk session. Rejects unauthenticated requests with 401 Unauthorized.
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const claims = auth.sessionClaims as Record<string, unknown> | null;
    const role = extractRole(auth.userId, claims);

    res.locals.auth = {
      clerkUserId: auth.userId,
      role,
      claims: claims || undefined,
    };

    next();
  } catch (error) {
    console.error("Require auth error:", error);
    sendError(res, "Authentication failed", 401);
  }
};

/**
 * Admin role authorization middleware:
 * Enforces least-privilege role checking. Rejects non-admin users with 403 Forbidden.
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const auth = res.locals.auth;

  if (!auth?.clerkUserId) {
    sendError(res, "Authentication required", 401);
    return;
  }

  if (auth.role !== "ADMIN") {
    sendError(res, "Admin access required", 403);
    return;
  }

  next();
};

