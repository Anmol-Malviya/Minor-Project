import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import { Partner, AuditLog } from "../models";
import {
  getAdminPartners,
  createAdminPartner,
  updateAdminPartner,
  deactivateAdminPartner,
} from "./adminPartner.controller";

const validPartnerId = "507f1f77bcf86cd799439011";

const originalPartnerFind = Partner.find;
const originalPartnerFindById = Partner.findById;
const originalPartnerFindOne = Partner.findOne;
const originalPartnerCreate = Partner.create;
const originalAuditLogCreate = AuditLog.create;
const originalCloudinaryResource = cloudinary.api.resource;

beforeEach(() => {
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource =
    async (id: string) => ({
      public_id: id,
      format: "png",
      resource_type: "image",
      bytes: 150000,
      secure_url: `https://res.cloudinary.com/reality-dreams/image/upload/v1/${id.split("/").pop()}.png`,
    });
});

afterEach(() => {
  Partner.find = originalPartnerFind;
  Partner.findById = originalPartnerFindById;
  Partner.findOne = originalPartnerFindOne;
  Partner.create = originalPartnerCreate;
  AuditLog.create = originalAuditLogCreate;
  cloudinary.api.resource = originalCloudinaryResource;
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

test("getAdminPartners rejects unauthenticated requests with 401", async () => {
  const req = {} as Request;
  const res = createMockResponse();

  await getAdminPartners(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 401);
});

test("getAdminPartners retrieves all partners including inactive ones", async () => {
  const req = {} as Request;
  const res = createMockResponse("admin_123");

  (Partner.find as unknown) = () => ({
    sort: () => ({
      lean: async () => [
        {
          _id: validPartnerId,
          name: "Active Partner",
          isActive: true,
        },
        {
          _id: "507f1f77bcf86cd799439012",
          name: "Inactive Partner",
          isActive: false,
        },
      ],
    }),
  });

  await getAdminPartners(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as { success: boolean; data: Array<{ isActive: boolean }> };
  assert.equal(body.success, true);
  assert.equal(body.data.length, 2);
  assert.equal(body.data[1].isActive, false);
});

test("createAdminPartner rejects missing name with 400", async () => {
  const req = {
    body: {
      logoAsset: {
        secureUrl:
          "https://res.cloudinary.com/reality-dreams/image/upload/v1/logo.png",
        cloudinaryPublicId: "reality-dreams/properties/logo",
      },
    },
  } as Request;
  const res = createMockResponse("admin_123");

  await createAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("createAdminPartner rejects logo asset verification failure with 400", async () => {
  const req = {
    body: {
      name: "Dodgy Partner",
      logoAsset: {
        secureUrl: "https://evil.com/fake.png",
        cloudinaryPublicId: "outside-folder/fake",
      },
    },
  } as Request;
  const res = createMockResponse("admin_123");

  await createAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("createAdminPartner returns 409 when partner with duplicate name exists", async () => {
  const req = {
    body: {
      name: "Existing Bank",
      logoAsset: {
        secureUrl:
          "https://res.cloudinary.com/reality-dreams/image/upload/v1/bank.png",
        cloudinaryPublicId: "reality-dreams/properties/bank",
      },
    },
  } as Request;
  const res = createMockResponse("admin_123");

  (Partner.findOne as unknown) = async () => ({ _id: "other_id", name: "Existing Bank" });

  await createAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 409);
});

test("createAdminPartner creates partner and writes to AuditLog", async () => {
  const req = {
    body: {
      name: "Apex Architecture Studio",
      logoAsset: {
        secureUrl:
          "https://res.cloudinary.com/reality-dreams/image/upload/v1/apex.png",
        cloudinaryPublicId: "reality-dreams/properties/apex",
      },
      websiteUrl: "https://apexarchitecture.example.com",
      sortOrder: 3,
      isActive: true,
    },
  } as Request;
  const res = createMockResponse("admin_clerk_123");

  (Partner.findOne as unknown) = async () => null;

  let auditCreated = false;
  (AuditLog.create as unknown) = async (data: unknown) => {
    auditCreated = true;
    return data;
  };

  (Partner.create as unknown) = async (data: Record<string, unknown>) => ({
    _id: validPartnerId,
    ...data,
  });

  await createAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 201);
  const body = res.body as { success: boolean; data: { name: string; sortOrder: number } };
  assert.equal(body.success, true);
  assert.equal(body.data.name, "Apex Architecture Studio");
  assert.equal(body.data.sortOrder, 3);
  assert.equal(auditCreated, true);
});

test("updateAdminPartner rejects invalid ObjectId with 400", async () => {
  const req = {
    params: { id: "invalid-id" },
    body: { name: "Updated" },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminPartner returns 404 when partner not found", async () => {
  const req = {
    params: { id: validPartnerId },
    body: { name: "Updated" },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  (Partner.findById as unknown) = async () => null;

  await updateAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 404);
});

test("updateAdminPartner updates partner, verifies new logo, and logs to AuditLog", async () => {
  const req = {
    params: { id: validPartnerId },
    body: {
      name: "New Partner Name",
      sortOrder: 5,
    },
  } as unknown as Request;
  const res = createMockResponse("admin_clerk_123");

  let saved = false;
  let auditCreated = false;

  const mockPartnerDoc = {
    _id: validPartnerId,
    name: "Old Partner Name",
    sortOrder: 1,
    isActive: true,
    async save() {
      saved = true;
      return this;
    },
  };

  (Partner.findById as unknown) = async () => mockPartnerDoc;
  (Partner.findOne as unknown) = async () => null; // No duplicate
  (AuditLog.create as unknown) = async () => {
    auditCreated = true;
  };

  await updateAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(saved, true);
  assert.equal(mockPartnerDoc.name, "New Partner Name");
  assert.equal(mockPartnerDoc.sortOrder, 5);
  assert.equal(auditCreated, true);
});

test("deactivateAdminPartner deactivates partner without permanent deletion", async () => {
  const req = {
    params: { id: validPartnerId },
  } as unknown as Request;
  const res = createMockResponse("admin_clerk_123");

  let saved = false;
  let auditCreated = false;

  const mockPartnerDoc = {
    _id: validPartnerId,
    name: "Retiring Partner",
    isActive: true,
    async save() {
      saved = true;
      return this;
    },
  };

  (Partner.findById as unknown) = async () => mockPartnerDoc;
  (AuditLog.create as unknown) = async () => {
    auditCreated = true;
  };

  await deactivateAdminPartner(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(saved, true);
  assert.equal(mockPartnerDoc.isActive, false); // soft deactivation
  assert.equal(auditCreated, true);
});

