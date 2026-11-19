import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { Partner } from "../models";
import { getPublicPartners } from "./partner.controller";

const originalPartnerFind = Partner.find;

afterEach(() => {
  Partner.find = originalPartnerFind;
});

function createMockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
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

test("getPublicPartners returns only active partners sorted by sortOrder", async () => {
  const req = {} as Request;
  const res = createMockResponse();

  (Partner.find as unknown) = (filter: Record<string, unknown>) => {
    // Assert query explicitly filters isActive: true
    assert.equal(filter.isActive, true);
    return {
      sort: () => ({
        lean: async () => [
          {
            _id: "507f1f77bcf86cd799439011",
            name: "HDFC Home Loans",
            logoAsset: {
              secureUrl:
                "https://res.cloudinary.com/reality-dreams/image/upload/v1/hdfc.png",
              cloudinaryPublicId: "reality-dreams/properties/hdfc_secret",
            },
            websiteUrl: "https://www.hdfcbank.com",
            sortOrder: 1,
            isActive: true,
          },
          {
            _id: "507f1f77bcf86cd799439012",
            name: "SBI Home Finance",
            logoAsset: {
              secureUrl:
                "https://res.cloudinary.com/reality-dreams/image/upload/v1/sbi.png",
              cloudinaryPublicId: "reality-dreams/properties/sbi_secret",
            },
            websiteUrl: "https://homeloans.sbi",
            sortOrder: 2,
            isActive: true,
          },
        ],
      }),
    };
  };

  await getPublicPartners(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as {
    success: boolean;
    data: Array<{
      _id: string;
      name: string;
      logoUrl: string;
      websiteUrl: string;
      sortOrder: number;
      cloudinaryPublicId?: string;
    }>;
  };

  assert.equal(body.success, true);
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].name, "HDFC Home Loans");
  assert.equal(
    body.data[0].logoUrl,
    "https://res.cloudinary.com/reality-dreams/image/upload/v1/hdfc.png"
  );
  assert.equal(body.data[0].sortOrder, 1);

  // Security check: NEVER leak cloudinaryPublicId in public partner response
  assert.equal(body.data[0].cloudinaryPublicId, undefined);
  assert.equal(body.data[1].cloudinaryPublicId, undefined);
});

test("getPublicPartners returns empty array when no active partners exist", async () => {
  const req = {} as Request;
  const res = createMockResponse();

  (Partner.find as unknown) = () => ({
    sort: () => ({
      lean: async () => [],
    }),
  });

  await getPublicPartners(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const body = res.body as { success: boolean; data: Array<unknown> };
  assert.equal(body.success, true);
  assert.deepEqual(body.data, []);
});

