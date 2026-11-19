import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { Property, Enquiry, Wishlist } from "../models";
import {
  getMyEnquiries,
  getMyWishlist,
  addToWishlist,
  removeFromWishlist,
} from "./me.controller";

const validPropertyId = "507f1f77bcf86cd799439011";
const secondPropertyId = "507f1f77bcf86cd799439022";

const originalPropertyFindOne = Property.findOne;
const originalEnquiryFind = Enquiry.find;
const originalEnquiryCountDocuments = Enquiry.countDocuments;
const originalWishlistFind = Wishlist.find;
const originalWishlistCountDocuments = Wishlist.countDocuments;
const originalWishlistCreate = Wishlist.create;
const originalWishlistFindOneAndDelete = Wishlist.findOneAndDelete;

afterEach(() => {
  Property.findOne = originalPropertyFindOne;
  Enquiry.find = originalEnquiryFind;
  Enquiry.countDocuments = originalEnquiryCountDocuments;
  Wishlist.find = originalWishlistFind;
  Wishlist.countDocuments = originalWishlistCountDocuments;
  Wishlist.create = originalWishlistCreate;
  Wishlist.findOneAndDelete = originalWishlistFindOneAndDelete;
});

function createMockResponse(authUserId?: string) {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    locals: authUserId ? { auth: { clerkUserId: authUserId, role: "USER" } } : {},
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

test("rejects unauthenticated requests to all /me endpoints with 401", async () => {
  const endpoints = [
    (req: Request, res: Response) => getMyEnquiries(req, res, () => {}),
    (req: Request, res: Response) => getMyWishlist(req, res, () => {}),
    (req: Request, res: Response) => addToWishlist(req, res, () => {}),
    (req: Request, res: Response) => removeFromWishlist(req, res, () => {}),
  ];

  for (const handler of endpoints) {
    const req = { params: { propertyId: validPropertyId }, query: {} } as unknown as Request;
    const res = createMockResponse(); // No auth locals
    await handler(req, res as unknown as Response);
    assert.equal(res.statusCode, 401);
    assert.equal((res.body as { success: boolean }).success, false);
  }
});

test("getMyEnquiries retrieves only current user's enquiries and strips internalNotes", async () => {
  let capturedQueryFilter: Record<string, unknown> = {};
  let capturedSelect = "";

  (Enquiry as unknown as { find: (filter: unknown) => unknown }).find = (filter) => {
    capturedQueryFilter = filter as Record<string, unknown>;
    return {
      select(fields: string) {
        capturedSelect = fields;
        return this;
      },
      populate() {
        return this;
      },
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
          {
            _id: "enq_1",
            propertyId: { _id: validPropertyId, title: "Property 1" },
            name: "Alice",
            email: "alice@example.com",
            phone: "+91 98765 43210",
            message: "Interested in property 1",
            status: "New",
            createdAt: new Date(),
          },
        ];
      },
    };
  };

  (Enquiry as unknown as { countDocuments: (filter: unknown) => Promise<number> }).countDocuments =
    async () => 1;

  const req = { query: { page: "1", limit: "10" } } as unknown as Request;
  const res = createMockResponse("user_alice");

  await getMyEnquiries(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(capturedQueryFilter.clerkUserId, "user_alice");
  assert.equal(capturedSelect.includes("internalNotes"), false);
  assert.equal(capturedSelect.includes("lastUpdatedBy"), false);

  const data = (res.body as { data: Record<string, unknown>[] }).data;
  assert.equal(data.length, 1);
  assert.equal("internalNotes" in data[0], false);
});

test("getMyWishlist retrieves only current user's wishlist and populates safe property fields", async () => {
  let capturedWishlistFilter: Record<string, unknown> = {};
  let capturedPopulateOptions: Record<string, unknown> = {};

  (Wishlist as unknown as { find: (filter: unknown) => unknown }).find = (filter) => {
    capturedWishlistFilter = filter as Record<string, unknown>;
    return {
      populate(options: Record<string, unknown>) {
        capturedPopulateOptions = options;
        return this;
      },
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
          {
            _id: "w_1",
            clerkUserId: "user_alice",
            propertyId: {
              _id: validPropertyId,
              title: "Lakefront Villa",
              slug: "lakefront-villa",
              priceAmount: 12000000,
              currency: "INR",
              status: "Published",
            },
            createdAt: new Date(),
          },
          // Property that was unpublished/archived -> populated propertyId is null
          {
            _id: "w_2",
            clerkUserId: "user_alice",
            propertyId: null,
            createdAt: new Date(),
          },
        ];
      },
    };
  };

  (Wishlist as unknown as { countDocuments: (filter: unknown) => Promise<number> }).countDocuments =
    async () => 2;

  const req = { query: {} } as unknown as Request;
  const res = createMockResponse("user_alice");

  await getMyWishlist(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(capturedWishlistFilter.clerkUserId, "user_alice");

  const select = capturedPopulateOptions.select as string;
  assert.equal(select.includes("createdBy"), false);
  assert.equal(select.includes("streetAddress"), false);
  assert.equal(select.includes("cloudinaryPublicId"), false);

  const data = (res.body as { data: Record<string, unknown>[] }).data;
  // Null (unpublished) items filtered out
  assert.equal(data.length, 1);
  assert.equal((data[0].propertyId as { title: string }).title, "Lakefront Villa");
});

test("addToWishlist successfully adds a Published property", async () => {
  let createdDoc: Record<string, unknown> = {};

  (Property as unknown as { findOne: (filter: unknown) => unknown }).findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return { _id: validPropertyId, title: "Lakefront Villa", status: "Published" };
    },
  });

  (Wishlist as unknown as { create: (doc: unknown) => unknown }).create = async (doc) => {
    createdDoc = doc as Record<string, unknown>;
    return {
      _id: "wish_123",
      clerkUserId: "user_alice",
      propertyId: validPropertyId,
      createdAt: new Date(),
    };
  };

  const req = { params: { propertyId: validPropertyId } } as unknown as Request;
  const res = createMockResponse("user_alice");

  await addToWishlist(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(createdDoc.clerkUserId, "user_alice");
});

test("addToWishlist rejects invalid property ID parameter with 400", async () => {
  const req = { params: { propertyId: "invalid-id" } } as unknown as Request;
  const res = createMockResponse("user_alice");

  await addToWishlist(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { success: boolean }).success, false);
});

test("addToWishlist rejects Draft, Sold, or Archived properties with 404", async () => {
  (Property as unknown as { findOne: (filter: unknown) => unknown }).findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return null; // Not found with status: "Published"
    },
  });

  const req = { params: { propertyId: validPropertyId } } as unknown as Request;
  const res = createMockResponse("user_alice");

  await addToWishlist(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 404);
  assert.equal((res.body as { success: boolean }).success, false);
});

test("addToWishlist returns 409 when adding a duplicate property", async () => {
  (Property as unknown as { findOne: (filter: unknown) => unknown }).findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return { _id: validPropertyId, status: "Published" };
    },
  });

  (Wishlist as unknown as { create: (doc: unknown) => unknown }).create = async () => {
    const error = new Error("Duplicate key error") as Error & { code: number };
    error.code = 11000;
    throw error;
  };

  const req = { params: { propertyId: validPropertyId } } as unknown as Request;
  const res = createMockResponse("user_alice");

  await addToWishlist(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 409);
  assert.equal((res.body as { message: string }).message, "Property is already in your wishlist");
});

test("removeFromWishlist removes only current user's property from wishlist", async () => {
  let capturedDeleteFilter: Record<string, unknown> = {};

  (Wishlist as unknown as { findOneAndDelete: (filter: unknown) => unknown }).findOneAndDelete =
    async (filter) => {
      capturedDeleteFilter = filter as Record<string, unknown>;
      return { _id: "wish_123" };
    };

  const req = { params: { propertyId: validPropertyId } } as unknown as Request;
  const res = createMockResponse("user_alice");

  await removeFromWishlist(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(capturedDeleteFilter.clerkUserId, "user_alice");
});

test("removeFromWishlist returns 404 when property is not in user's wishlist", async () => {
  (Wishlist as unknown as { findOneAndDelete: (filter: unknown) => unknown }).findOneAndDelete =
    async () => null;

  const req = { params: { propertyId: secondPropertyId } } as unknown as Request;
  const res = createMockResponse("user_alice");

  await removeFromWishlist(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 404);
  assert.equal((res.body as { success: boolean }).success, false);
});

