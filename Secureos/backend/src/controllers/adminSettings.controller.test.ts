import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import { SiteSettings, AuditLog } from "../models";
import {
  getAdminSettings,
  updateAdminSettings,
} from "./adminSettings.controller";

const originalSiteSettingsFindOne = SiteSettings.findOne;
const originalAuditLogCreate = AuditLog.create;
const originalCloudinaryResource = cloudinary.api.resource;

beforeEach(() => {
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource =
    async (id: string) => ({
      public_id: id,
      format: "png",
      resource_type: "image",
      bytes: 120000,
      secure_url: `https://res.cloudinary.com/reality-dreams/image/upload/v1/${id.split("/").pop()}.png`,
    });
});

afterEach(() => {
  SiteSettings.findOne = originalSiteSettingsFindOne;
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

test("getAdminSettings returns existing database settings", async () => {
  const req = {} as Request;
  const res = createMockResponse("admin_123");

  (SiteSettings.findOne as unknown) = () => ({
    lean: async () => ({
      businessContact: { phone: "+123456789", email: "info@realitydreams.com" },
      hero: { headline: "Find Luxury", description: "Best homes", ctaText: "Browse" },
      sectionOrder: ["bestValue", "trending", "about", "partners"],
    }),
  });

  await getAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as { success: boolean; data: { hero: { headline: string } } };
  assert.equal(body.success, true);
  assert.equal(body.data.hero.headline, "Find Luxury");
});

test("getAdminSettings returns default settings gracefully when DB has no document", async () => {
  const req = {} as Request;
  const res = createMockResponse("admin_123");

  (SiteSettings.findOne as unknown) = () => ({
    lean: async () => null,
  });

  await getAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as { success: boolean; data: { hero: { headline: string }; sectionOrder: string[] } };
  assert.equal(body.success, true);
  assert.ok(body.data.hero.headline.length > 0);
  assert.ok(Array.isArray(body.data.sectionOrder));
});

test("updateAdminSettings rejects unauthenticated requests with 401", async () => {
  const req = { body: {} } as Request;
  const res = createMockResponse();

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 401);
});

test("updateAdminSettings rejects invalid sectionOrder duplicates with 400", async () => {
  const req = {
    body: {
      sectionOrder: ["bestValue", "bestValue", "about"],
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminSettings rejects arbitrary fields with 400", async () => {
  const req = {
    body: {
      unauthorizedField: "hacker",
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminSettings rejects invalid logo asset if verification fails with 400", async () => {
  const req = {
    body: {
      logoAsset: {
        secureUrl: "https://evil.com/fake-logo.png",
        cloudinaryPublicId: "outside-folder/logo",
      },
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminSettings updates settings, sets updatedBy, and logs to AuditLog", async () => {
  const req = {
    body: {
      hero: {
        headline: "Discover Your Dream Sanctuary",
        description: "Premium curated luxury properties worldwide",
        ctaText: "Explore Properties",
      },
      sectionOrder: ["trending", "bestValue", "about", "partners"],
      logoAsset: {
        secureUrl:
          "https://res.cloudinary.com/reality-dreams/image/upload/v1/brand_logo.png",
        cloudinaryPublicId: "reality-dreams/properties/brand_logo",
      },
    },
  } as unknown as Request;
  const res = createMockResponse("admin_clerk_123");

  let saved = false;
  let auditCreated = false;

  const mockSettingsDoc = {
    _id: "507f1f77bcf86cd799439011",
    hero: { headline: "Old", description: "Old", ctaText: "Old" },
    businessContact: { phone: "", email: "", address: "" },
    sectionVisibility: { showBestValue: true, showTrending: true, showAbout: true, showPartners: true },
    sectionOrder: ["bestValue", "trending", "about", "partners"],
    logoAsset: undefined as unknown,
    updatedBy: undefined as string | undefined,
    async save() {
      saved = true;
      return this;
    },
  };

  (SiteSettings.findOne as unknown) = async () => mockSettingsDoc;

  (AuditLog.create as unknown) = async (data: unknown) => {
    auditCreated = true;
    return data;
  };

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(saved, true);
  assert.equal(mockSettingsDoc.hero.headline, "Discover Your Dream Sanctuary");
  assert.equal(mockSettingsDoc.updatedBy, "admin_clerk_123");
  assert.equal(auditCreated, true);
});

test("updateAdminSettings rejects invalid socialLinks URL with 400", async () => {
  const req = {
    body: {
      socialLinks: [
        { platform: "Instagram", url: "not-a-valid-url" },
      ],
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminSettings rejects unexpected fields inside socialLinks with 400", async () => {
  const req = {
    body: {
      socialLinks: [
        { platform: "Instagram", url: "https://instagram.com/realitydreams", extraField: "tamper" },
      ],
    },
  } as unknown as Request;
  const res = createMockResponse("admin_123");

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
});

test("updateAdminSettings updating socialLinks preserves unrelated existing settings", async () => {
  const req = {
    body: {
      socialLinks: [
        { platform: "Instagram", url: "https://instagram.com/realitydreams" },
        { platform: "LinkedIn", url: "https://linkedin.com/company/realitydreams" },
      ],
    },
  } as unknown as Request;
  const res = createMockResponse("admin_clerk_123");

  let saved = false;
  let auditCreated = false;

  const mockSettingsDoc = {
    _id: "507f1f77bcf86cd799439011",
    hero: { headline: "Existing Headline", description: "Existing Desc", ctaText: "Existing CTA" },
    businessContact: { phone: "+911234567890", email: "existing@realitydreams.com", address: "Existing Address" },
    sectionVisibility: { showBestValue: true, showTrending: true, showAbout: true, showPartners: true },
    sectionOrder: ["bestValue", "trending", "about", "partners"],
    socialLinks: [] as Array<{ platform: string; url: string }>,
    updatedBy: undefined as string | undefined,
    async save() {
      saved = true;
      return this;
    },
  };

  (SiteSettings.findOne as unknown) = async () => mockSettingsDoc;
  (AuditLog.create as unknown) = async () => {
    auditCreated = true;
  };

  await updateAdminSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(saved, true);
  // Verify socialLinks were updated
  assert.equal(mockSettingsDoc.socialLinks.length, 2);
  assert.equal(mockSettingsDoc.socialLinks[0].platform, "Instagram");
  // Verify unrelated existing settings were preserved
  assert.equal(mockSettingsDoc.hero.headline, "Existing Headline");
  assert.equal(mockSettingsDoc.businessContact.email, "existing@realitydreams.com");
  assert.equal(mockSettingsDoc.updatedBy, "admin_clerk_123");
  assert.equal(auditCreated, true);
});


