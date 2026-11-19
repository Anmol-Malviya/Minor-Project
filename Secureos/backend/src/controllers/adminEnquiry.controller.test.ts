import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { Enquiry, AuditLog } from "../models";
import {
  getAdminEnquiries,
  getAdminEnquiryById,
  updateAdminEnquiry,
} from "./adminEnquiry.controller";

const validEnquiryId = "507f1f77bcf86cd799439011";

const originalEnquiryFind = Enquiry.find;
const originalEnquiryFindById = Enquiry.findById;
const originalEnquiryCountDocuments = Enquiry.countDocuments;
const originalAuditLogCreate = AuditLog.create;

afterEach(() => {
  Enquiry.find = originalEnquiryFind;
  Enquiry.findById = originalEnquiryFindById;
  Enquiry.countDocuments = originalEnquiryCountDocuments;
  AuditLog.create = originalAuditLogCreate;
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

test("getAdminEnquiries rejects unauthenticated requests with 401", async () => {
  const req = { query: {} } as Request;
  const res = createMockResponse();

  await getAdminEnquiries(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 401);
});

test("getAdminEnquiries rejects invalid query parameters with 400", async () => {
  const req = {
    query: {
      status: "InvalidStatus",
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await getAdminEnquiries(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("getAdminEnquiries retrieves enquiries with status filter, keyword, and internalNotes", async () => {
  const req = {
    query: {
      status: "New",
      keyword: "John",
      page: "1",
      limit: "10",
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  (Enquiry.countDocuments as unknown) = async () => 1;
  (Enquiry.find as unknown) = () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          populate: () => ({
            lean: async () => [
              {
                _id: validEnquiryId,
                name: "John Smith",
                email: "john@example.com",
                phone: "+1234567890",
                message: "Interested in visiting",
                status: "New",
                internalNotes: "High intent buyer",
                propertyId: {
                  title: "Oceanfront Luxury Villa",
                  slug: "oceanfront-luxury-villa",
                },
              },
            ],
          }),
        }),
      }),
    }),
  });

  await getAdminEnquiries(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as {
    success: boolean;
    data: Array<{ internalNotes?: string; name: string }>;
    pagination: { total: number; page: number; limit: number; totalPages: number };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].name, "John Smith");
  assert.equal(body.data[0].internalNotes, "High intent buyer");
  assert.equal(body.pagination.total, 1);
});

test("getAdminEnquiryById rejects invalid ObjectId with 400", async () => {
  const req = {
    params: { id: "invalid-id" },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await getAdminEnquiryById(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("getAdminEnquiryById returns 404 for nonexistent enquiry", async () => {
  const req = {
    params: { id: validEnquiryId },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  (Enquiry.findById as unknown) = () => ({
    populate: () => ({
      lean: async () => null,
    }),
  });

  await getAdminEnquiryById(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 404);
});

test("getAdminEnquiryById retrieves single enquiry with property context", async () => {
  const req = {
    params: { id: validEnquiryId },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  (Enquiry.findById as unknown) = () => ({
    populate: () => ({
      lean: async () => ({
        _id: validEnquiryId,
        name: "Alice",
        status: "Contacted",
        internalNotes: "Follow up next Tuesday",
        propertyId: {
          title: "Modern Apartment",
        },
      }),
    }),
  });

  await getAdminEnquiryById(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as { success: boolean; data: { name: string; internalNotes: string } };
  assert.equal(body.success, true);
  assert.equal(body.data.name, "Alice");
  assert.equal(body.data.internalNotes, "Follow up next Tuesday");
});

test("updateAdminEnquiry rejects attempts to modify immutable fields with 400", async () => {
  const req = {
    params: { id: validEnquiryId },
    body: {
      name: "Malicious Tamper",
      status: "Contacted",
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminEnquiry(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminEnquiry rejects empty update body with 400", async () => {
  const req = {
    params: { id: validEnquiryId },
    body: {},
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminEnquiry(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminEnquiry updates status, internalNotes, tracks lastUpdatedBy, and logs to AuditLog", async () => {
  const req = {
    params: { id: validEnquiryId },
    body: {
      status: "Visit Scheduled",
      internalNotes: "Scheduled for Saturday 3PM",
    },
  } as unknown as Request;
  const res = createMockResponse("admin_clerk_123");

  let saved = false;
  let auditCreated = false;
  let auditPayload: Record<string, unknown> | null = null;

  const mockEnquiryDoc = {
    _id: validEnquiryId,
    status: "New",
    internalNotes: "Initial note",
    lastUpdatedBy: undefined as string | undefined,
    async save() {
      saved = true;
      return this;
    },
  };

  (Enquiry.findById as unknown) = (id: string) => {
    if (saved) {
      return {
        populate: () => ({
          lean: async () => ({
            ...mockEnquiryDoc,
            propertyId: { title: "Oceanfront Luxury Villa" },
          }),
        }),
      };
    }
    return Promise.resolve(mockEnquiryDoc);
  };

  (AuditLog.create as unknown) = async (data: Record<string, unknown>) => {
    auditCreated = true;
    auditPayload = data;
    return data;
  };

  await updateAdminEnquiry(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(saved, true);
  assert.equal(mockEnquiryDoc.status, "Visit Scheduled");
  assert.equal(mockEnquiryDoc.internalNotes, "Scheduled for Saturday 3PM");
  assert.equal(mockEnquiryDoc.lastUpdatedBy, "admin_clerk_123");
  assert.equal(auditCreated, true);
  assert.equal(auditPayload?.["action"], "UPDATE_ENQUIRY");
  assert.equal(auditPayload?.["actorClerkUserId"], "admin_clerk_123");
});

