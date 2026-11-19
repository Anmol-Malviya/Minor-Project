import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { Property, Enquiry } from "../models";
import { getAdminOverview } from "./adminOverview.controller";

const originalPropertyAggregate = Property.aggregate;
const originalEnquiryAggregate = Enquiry.aggregate;
const originalEnquiryFind = Enquiry.find;
const originalPropertyFind = Property.find;

afterEach(() => {
  Property.aggregate = originalPropertyAggregate;
  Enquiry.aggregate = originalEnquiryAggregate;
  Enquiry.find = originalEnquiryFind;
  Property.find = originalPropertyFind;
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

test("getAdminOverview rejects unauthenticated requests with 401", async () => {
  const req = {} as Request;
  const res = createMockResponse(); // no adminId
  let nextCalled = false;

  await getAdminOverview(req, res as unknown as Response, (err) => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("getAdminOverview returns structured aggregations and recent activity", async () => {
  const req = {} as Request;
  const res = createMockResponse("admin_clerk_123");

  (Property.aggregate as unknown) = async () => [
    { _id: "Published", count: 12 },
    { _id: "Draft", count: 4 },
    { _id: "Sold", count: 3 },
    { _id: "Archived", count: 1 },
  ];

  (Enquiry.aggregate as unknown) = async () => [
    { _id: "New", count: 7 },
    { _id: "Contacted", count: 5 },
    { _id: "Visit Scheduled", count: 2 },
    { _id: "Closed", count: 10 },
    { _id: "Spam", count: 1 },
  ];

  (Enquiry.find as unknown) = () => ({
    sort: () => ({
      limit: () => ({
        populate: () => ({
          lean: async () => [
            {
              _id: "enquiry_1",
              name: "Jane Doe",
              email: "jane@example.com",
              status: "New",
              propertyId: {
                title: "Sunset Villa",
                slug: "sunset-villa",
              },
            },
          ],
        }),
      }),
    }),
  });

  (Property.find as unknown) = () => ({
    sort: () => ({
      limit: () => ({
        select: () => ({
          lean: async () => [
            {
              _id: "prop_1",
              title: "Sunset Villa",
              slug: "sunset-villa",
              status: "Published",
              priceAmount: 850000,
            },
          ],
        }),
      }),
    }),
  });

  await getAdminOverview(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as {
    success: boolean;
    data: {
      properties: { total: number; byStatus: Record<string, number> };
      enquiries: {
        total: number;
        byStatus: Record<string, number>;
        newEnquiriesCount: number;
      };
      recentEnquiries: Array<unknown>;
      recentProperties: Array<unknown>;
    };
  };

  assert.equal(body.success, true);
  assert.equal(body.data.properties.total, 20);
  assert.equal(body.data.properties.byStatus.Published, 12);
  assert.equal(body.data.properties.byStatus.Draft, 4);
  assert.equal(body.data.properties.byStatus.Sold, 3);
  assert.equal(body.data.properties.byStatus.Archived, 1);

  assert.equal(body.data.enquiries.total, 25);
  assert.equal(body.data.enquiries.byStatus.New, 7);
  assert.equal(body.data.enquiries.newEnquiriesCount, 7);
  assert.equal(body.data.enquiries.byStatus.Contacted, 5);
  assert.equal(body.data.enquiries.byStatus["Visit Scheduled"], 2);
  assert.equal(body.data.enquiries.byStatus.Closed, 10);
  assert.equal(body.data.enquiries.byStatus.Spam, 1);

  assert.equal(body.data.recentEnquiries.length, 1);
  assert.equal(body.data.recentProperties.length, 1);
});

