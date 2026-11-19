import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import adminRoutes from "./admin.routes";

function createMockResponse(role?: "USER" | "ADMIN", clerkUserId?: string) {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    locals: clerkUserId
      ? { auth: { clerkUserId, role: role || "USER" } }
      : {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

test("requireAdmin rejects authenticated non-admin user with 403 Forbidden", () => {
  const req = {} as Request;
  const res = createMockResponse("USER", "regular_user_123");
  let nextCalled = false;

  requireAdmin(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  const body = res.body as { success: boolean; message: string };
  assert.equal(body.success, false);
  assert.equal(body.message, "Admin access required");
  assert.equal(nextCalled, false);
});

test("requireAdmin rejects unauthenticated request with 401 Unauthorized", () => {
  const req = {} as Request;
  const res = createMockResponse(); // no auth in locals
  let nextCalled = false;

  requireAdmin(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  const body = res.body as { success: boolean; message: string };
  assert.equal(body.success, false);
  assert.equal(body.message, "Authentication required");
  assert.equal(nextCalled, false);
});

test("requireAdmin permits verified ADMIN users", () => {
  const req = {} as Request;
  const res = createMockResponse("ADMIN", "admin_clerk_123");
  let nextCalled = false;

  requireAdmin(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});

test("admin router has top-level requireAuth and requireAdmin protection", () => {
  // Inspect router stack to ensure first two handlers are auth and admin guards
  const middlewareNames = adminRoutes.stack
    .filter((layer) => layer.name === "requireAuth" || layer.name === "requireAdmin")
    .map((layer) => layer.name);

  assert.ok(
    middlewareNames.includes("requireAuth"),
    "requireAuth must be mounted on admin router"
  );
  assert.ok(
    middlewareNames.includes("requireAdmin"),
    "requireAdmin must be mounted on admin router"
  );
});

