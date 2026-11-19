import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response, NextFunction } from "express";
import { extractRole, requireAdmin, requireAuth, optionalAuth } from "./auth";
import { AuthContext } from "../types/auth";

test("extractRole identifies ADMIN from claims metadata", () => {
  assert.equal(
    extractRole("user_123", { metadata: { role: "ADMIN" } }),
    "ADMIN"
  );
  assert.equal(
    extractRole("user_123", { public_metadata: { role: "admin" } }),
    "ADMIN"
  );
  assert.equal(
    extractRole("user_123", { publicMetadata: { role: "ADMIN" } }),
    "ADMIN"
  );
  assert.equal(
    extractRole("user_123", { metadata: { role: "USER" } }),
    "USER"
  );
  assert.equal(extractRole("user_123", null), "USER");
});

test("extractRole identifies initial admin from environment variable", () => {
  const original = process.env.INITIAL_ADMIN_CLERK_ID;
  process.env.INITIAL_ADMIN_CLERK_ID = "admin_master_1";

  try {
    assert.equal(extractRole("admin_master_1", null), "ADMIN");
    assert.equal(extractRole("other_user", null), "USER");
  } finally {
    process.env.INITIAL_ADMIN_CLERK_ID = original;
  }
});

test("requireAdmin permits admin users and rejects non-admin users", () => {
  const req = {} as Request;
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  // Case 1: No auth context -> 401
  let statusCode = 0;
  let responseBody: unknown;
  const resNoAuth = {
    locals: {},
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  requireAdmin(req, resNoAuth, next);
  assert.equal(statusCode, 401);
  assert.equal(nextCalled, false);

  // Case 2: User role -> 403
  const resUser = {
    locals: { auth: { clerkUserId: "u1", role: "USER" } as AuthContext },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  requireAdmin(req, resUser, next);
  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);

  // Case 3: Admin role -> next called
  const resAdmin = {
    locals: { auth: { clerkUserId: "u1", role: "ADMIN" } as AuthContext },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  requireAdmin(req, resAdmin, next);
  assert.equal(nextCalled, true);
});

