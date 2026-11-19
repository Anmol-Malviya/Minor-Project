import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { UserProfile } from "../models";
import { getAdminUsers } from "./adminUser.controller";

const originalUserProfileFind = UserProfile.find;
const originalUserProfileCountDocuments = UserProfile.countDocuments;

afterEach(() => {
  UserProfile.find = originalUserProfileFind;
  UserProfile.countDocuments = originalUserProfileCountDocuments;
});

function createMockResponse(adminId?: string) {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    locals: adminId ? { auth: { clerkUserId: adminId, role: "ADMIN" } } : {},
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

test("getAdminUsers rejects unauthenticated requests with 401", async () => {
  const req = { query: {} } as Request;
  const res = createMockResponse();

  await getAdminUsers(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 401);
});

test("getAdminUsers rejects invalid query parameters with 400", async () => {
  const req = {
    query: {
      page: "-1",
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await getAdminUsers(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("getAdminUsers retrieves users with safe field projection and pagination", async () => {
  const req = {
    query: {
      keyword: "Alice",
      page: "1",
      limit: "10",
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  (UserProfile.countDocuments as unknown) = async () => 1;
  (UserProfile.find as unknown) = () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          select: () => ({
            lean: async () => [
              {
                _id: "507f1f77bcf86cd799439011",
                name: "Alice Johnson",
                email: "alice@example.com",
                phone: "+1987654321",
                avatarUrl: "https://example.com/avatar.jpg",
                role: "USER",
                clerkUserId: "user_clerk_456",
              },
            ],
          }),
        }),
      }),
    }),
  });

  await getAdminUsers(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as {
    success: boolean;
    data: Array<{ name: string; email: string; role: string }>;
    pagination: { total: number; page: number; limit: number; totalPages: number };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].name, "Alice Johnson");
  assert.equal(body.data[0].role, "USER");
  assert.equal(body.pagination.total, 1);
});

