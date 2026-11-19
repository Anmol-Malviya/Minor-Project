import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { Request, Response } from "express";
import cloudinary from "../config/cloudinary";
import { Property } from "../models";
import {
  getAdminProperties,
  getAdminPropertyById,
  createAdminProperty,
  updateAdminProperty,
  archiveAdminProperty,
} from "./adminProperty.controller";
import { generateUploadSignature } from "./upload.controller";

const validPropertyId = "507f1f77bcf86cd799439011";

const originalPropertyFind = Property.find;
const originalPropertyFindById = Property.findById;
const originalPropertyFindByIdAndUpdate = Property.findByIdAndUpdate;
const originalPropertyFindOne = Property.findOne;
const originalPropertyCreate = Property.create;
const originalPropertyCountDocuments = Property.countDocuments;
const originalPropertyExists = Property.exists;
const originalCloudinaryResource = cloudinary.api.resource;
const originalCloudinaryDestroy = cloudinary.uploader.destroy;

beforeEach(() => {
  // Default Cloudinary mock: accepts assets in reality-dreams/properties
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource =
    async (id) => ({
      public_id: id,
      format: "jpg",
      resource_type: "image",
      bytes: 500000,
      secure_url: `https://res.cloudinary.com/reality-dreams/image/upload/v1/${id.split("/").pop()}.jpg`,
    });

  (cloudinary.uploader as unknown as { destroy: (id: string) => unknown }).destroy =
    async (id) => ({ result: "ok" });
});

afterEach(() => {
  Property.find = originalPropertyFind;
  Property.findById = originalPropertyFindById;
  Property.findByIdAndUpdate = originalPropertyFindByIdAndUpdate;
  Property.findOne = originalPropertyFindOne;
  Property.create = originalPropertyCreate;
  Property.countDocuments = originalPropertyCountDocuments;
  Property.exists = originalPropertyExists;
  cloudinary.api.resource = originalCloudinaryResource;
  cloudinary.uploader.destroy = originalCloudinaryDestroy;
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

test("rejects unauthenticated requests to admin property handlers with 401", async () => {
  const handlers = [
    (req: Request, res: Response) => createAdminProperty(req, res, () => {}),
    (req: Request, res: Response) => updateAdminProperty(req, res, () => {}),
    (req: Request, res: Response) => archiveAdminProperty(req, res, () => {}),
    (req: Request, res: Response) => generateUploadSignature(req, res, () => {}),
  ];

  for (const handler of handlers) {
    const req = { params: { id: validPropertyId }, body: {}, query: {} } as unknown as Request;
    const res = createMockResponse(); // No auth locals
    await handler(req, res as unknown as Response);
    assert.equal(res.statusCode, 401);
  }
});

test("createAdminProperty sets createdBy and lastUpdatedBy from verified admin identity", async () => {
  let createdPayload: Record<string, unknown> = {};

  (Property as unknown as { create: (doc: unknown) => unknown }).create = async (doc) => {
    createdPayload = doc as Record<string, unknown>;
    return {
      _id: validPropertyId,
      ...createdPayload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  const req = {
    body: {
      title: "Hillside Mansion",
      slug: "hillside-mansion",
      description: "Magnificent hillside estate with panoramic views.",
      priceAmount: 25000000,
      currency: "INR",
      propertyType: "Villa",
      status: "Draft",
      location: {
        city: "Shillong",
        state: "Meghalaya",
        locality: "Laitumkhrah",
        streetAddress: "123 Private Lane",
      },
      specifications: {
        area: 4500,
        bedrooms: 5,
        bathrooms: 4,
      },
      images: [
        {
          secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/mansion_1.jpg",
          cloudinaryPublicId: "reality-dreams/properties/mansion_1",
          altText: "Front view",
          sortOrder: 0,
          isPrimary: true,
        },
      ],
      isBestValue: false,
      isTrending: true,
    },
  } as unknown as Request;

  const res = createMockResponse("admin_boss_1");

  await createAdminProperty(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(createdPayload.createdBy, "admin_boss_1");
  assert.equal(createdPayload.lastUpdatedBy, "admin_boss_1");
  assert.equal(createdPayload.status, "Draft");
});

test("createAdminProperty rejects image with verification failure (e.g. not found) with 400", async () => {
  (cloudinary.api as unknown as { resource: () => unknown }).resource = async () => {
    throw new Error("Resource not found");
  };

  const req = {
    body: {
      title: "Spurious Property",
      slug: "spurious-property",
      description: "Testing image verification failure.",
      priceAmount: 1000000,
      propertyType: "Plot",
      status: "Draft",
      location: { city: "Guwahati", state: "Assam" },
      images: [
        {
          secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/fake.jpg",
          cloudinaryPublicId: "reality-dreams/properties/fake",
          isPrimary: true,
        },
      ],
    },
  } as unknown as Request;

  const res = createMockResponse("admin_boss_1");

  await createAdminProperty(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { success: boolean }).success, false);
});

test("createAdminProperty rejects multiple primary images with 400", async () => {
  const req = {
    body: {
      title: "Luxury Condo",
      slug: "luxury-condo",
      description: "A luxury condo in the city center.",
      priceAmount: 8500000,
      propertyType: "Apartment",
      status: "Draft",
      location: { city: "Guwahati", state: "Assam" },
      images: [
        {
          secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/img1.jpg",
          cloudinaryPublicId: "reality-dreams/properties/img1",
          isPrimary: true,
        },
        {
          secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/img2.jpg",
          cloudinaryPublicId: "reality-dreams/properties/img2",
          isPrimary: true,
        },
      ],
    },
  } as unknown as Request;

  const res = createMockResponse("admin_boss_1");

  await createAdminProperty(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { success: boolean }).success, false);
});

test("createAdminProperty requires image and primary image when status is Published", async () => {
  const reqNoImages = {
    body: {
      title: "Commercial Plot",
      slug: "commercial-plot",
      description: "Prime commercial land ready for development.",
      priceAmount: 15000000,
      propertyType: "Plot",
      status: "Published",
      location: { city: "Guwahati", state: "Assam" },
      images: [],
    },
  } as unknown as Request;

  const res = createMockResponse("admin_boss_1");

  await createAdminProperty(reqNoImages, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { success: boolean }).success, false);
});

test("getAdminProperties retrieves properties across all statuses with pagination", async () => {
  let capturedFilter: Record<string, unknown> = {};

  (Property as unknown as { find: (filter: unknown) => unknown }).find = (filter) => {
    capturedFilter = filter as Record<string, unknown>;
    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      async lean() {
        return [
          { _id: "p_draft", title: "Draft Property", status: "Draft" },
          { _id: "p_archived", title: "Archived Property", status: "Archived" },
        ];
      },
    };
  };

  (Property as unknown as { countDocuments: (filter: unknown) => Promise<number> }).countDocuments =
    async () => 2;

  const req = { query: { status: "Draft", page: "1", limit: "10" } } as unknown as Request;
  const res = createMockResponse("admin_boss_1");

  await getAdminProperties(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(capturedFilter.status, "Draft");
  const data = (res.body as { data: Record<string, unknown>[] }).data;
  assert.equal(data.length, 2);
});

test("getAdminPropertyById retrieves full property including Draft status", async () => {
  (Property as unknown as { findById: (id: string) => unknown }).findById = () => ({
    async lean() {
      return {
        _id: validPropertyId,
        title: "Hidden Draft",
        status: "Draft",
        createdBy: "admin_author",
        location: { streetAddress: "Private Road" },
      };
    },
  });

  const req = { params: { id: validPropertyId } } as unknown as Request;
  const res = createMockResponse("admin_boss_1");

  await getAdminPropertyById(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const data = (res.body as { data: Record<string, unknown> }).data;
  assert.equal(data.status, "Draft");
  assert.equal(data.createdBy, "admin_author");
});

test("updateAdminProperty updates details and tracks lastUpdatedBy", async () => {
  let saved = false;
  const mockPropertyDoc = {
    _id: validPropertyId,
    title: "Old Title",
    slug: "old-title",
    priceAmount: 5000000,
    status: "Draft",
    isBestValue: false,
    images: [],
    location: { city: "Guwahati", state: "Assam", streetAddress: "Old Address" },
    specifications: { bedrooms: 3, area: 1200 },
    lastUpdatedBy: "previous_admin",
    async save() {
      saved = true;
      return this;
    },
  };

  (Property as unknown as { findById: (id: string) => unknown }).findById = async () =>
    mockPropertyDoc;

  const req = {
    params: { id: validPropertyId },
    body: {
      title: "Updated Title",
      priceAmount: 6000000,
      isBestValue: true,
      location: { locality: "Beltola" },
    },
  } as unknown as Request;

  const res = createMockResponse("admin_editor_2");

  await updateAdminProperty(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(saved, true);
  assert.equal(mockPropertyDoc.title, "Updated Title");
  assert.equal(mockPropertyDoc.priceAmount, 6000000);
  assert.equal(mockPropertyDoc.isBestValue, true);
  assert.equal(mockPropertyDoc.location.city, "Guwahati");
  assert.equal((mockPropertyDoc.location as { locality?: string }).locality, "Beltola");
  assert.equal(mockPropertyDoc.lastUpdatedBy, "admin_editor_2");
});

test("updateAdminProperty preserves old images when document save fails", async () => {
  let destroyCalled = false;
  (cloudinary.uploader as unknown as { destroy: () => unknown }).destroy = async () => {
    destroyCalled = true;
    return { result: "ok" };
  };

  const oldImages = [
    {
      secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/old_img.jpg",
      cloudinaryPublicId: "reality-dreams/properties/old_img",
      isPrimary: true,
      sortOrder: 0,
      altText: "Old",
    },
  ];

  const mockPropertyDoc = {
    _id: validPropertyId,
    title: "Old Title",
    slug: "old-title",
    priceAmount: 5000000,
    status: "Draft",
    images: oldImages,
    location: { city: "Guwahati", state: "Assam" },
    async save() {
      throw new Error("Simulated database failure during save");
    },
  };

  (Property as unknown as { findById: (id: string) => unknown }).findById = async () =>
    mockPropertyDoc;

  const req = {
    params: { id: validPropertyId },
    body: {
      images: [
        {
          secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/new_img.jpg",
          cloudinaryPublicId: "reality-dreams/properties/new_img",
          isPrimary: true,
        },
      ],
    },
  } as unknown as Request;

  const res = createMockResponse("admin_editor_2");

  let errorCaught: unknown;
  await updateAdminProperty(req, res as unknown as Response, (err) => {
    errorCaught = err;
  });

  // Verify save error was passed to next()
  assert.ok(errorCaught);
  // Verify destroy was NEVER called because save failed
  assert.equal(destroyCalled, false);
});

test("archiveAdminProperty sets status to Archived without permanent deletion", async () => {
  let capturedUpdate: Record<string, unknown> = {};

  (Property as unknown as {
    findByIdAndUpdate: (id: string, update: unknown, options: unknown) => unknown;
  }).findByIdAndUpdate = async (_id, update) => {
    capturedUpdate = update as Record<string, unknown>;
    return {
      _id: validPropertyId,
      status: "Archived",
    };
  };

  const req = { params: { id: validPropertyId } } as unknown as Request;
  const res = createMockResponse("admin_boss_1");

  await archiveAdminProperty(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdate.status, "Archived");
  assert.equal(capturedUpdate.lastUpdatedBy, "admin_boss_1");
});

test("generateUploadSignature returns signature without exposing Cloudinary secret", async () => {
  const originalSecret = process.env.CLOUDINARY_API_SECRET;
  process.env.CLOUDINARY_API_SECRET = "super_secret_key_12345";
  process.env.CLOUDINARY_API_KEY = "public_api_key_67890";
  process.env.CLOUDINARY_CLOUD_NAME = "reality-dreams";

  try {
    const req = {} as Request;
    const res = createMockResponse("admin_boss_1");

    await generateUploadSignature(req, res as unknown as Response, () => {});

    assert.equal(res.statusCode, 200);
    const data = (res.body as { data: Record<string, unknown> }).data;

    assert.ok(data.signature);
    assert.ok(data.timestamp);
    assert.equal(data.apiKey, "public_api_key_67890");
    assert.equal(data.cloudName, "reality-dreams");
    assert.equal(data.folder, "reality-dreams/properties");

    // Strictly ensure secret never appears anywhere in the response body
    const serialized = JSON.stringify(res.body);
    assert.equal(serialized.includes("super_secret_key_12345"), false);
  } finally {
    process.env.CLOUDINARY_API_SECRET = originalSecret;
  }
});

test("generateUploadSignature rejects arbitrary folder parameter with 400", async () => {
  const req = {
    body: { folder: "unauthorized/arbitrary/folder" },
  } as unknown as Request;
  const res = createMockResponse("admin_boss_1");

  await generateUploadSignature(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { success: boolean }).success, false);
});

test("generateUploadSignature rejects arbitrary request body parameters with 400", async () => {
  const req = {
    body: { maliciousParam: "inject_value" },
  } as unknown as Request;
  const res = createMockResponse("admin_boss_1");

  await generateUploadSignature(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { success: boolean }).success, false);
});
