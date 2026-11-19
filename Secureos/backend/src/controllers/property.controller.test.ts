import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import Property from "../models/Property";
import { getPublishedProperties, getPropertyBySlug } from "./property.controller";

type Fixture = {
  _id: string;
  title: string;
  slug: string;
  description: string;
  priceAmount: number;
  propertyType: string;
  status: string;
  location: { city: string; state: string; locality: string };
  specifications: { bedrooms: number; bathrooms: number; area: number };
  createdAt: Date;
  createdBy: string;
  streetAddress: string;
  isBestValue?: boolean;
  isTrending?: boolean;
};

const fixtures: Fixture[] = [
  {
    _id: "p1",
    title: "City View Apartment",
    slug: "city-view-apartment",
    description: "A spacious home close to the park",
    priceAmount: 8_000_000,
    propertyType: "Apartment",
    status: "Published",
    location: { city: "Guwahati", state: "Assam", locality: "Beltola" },
    specifications: { bedrooms: 3, bathrooms: 2, area: 1400 },
    createdAt: new Date("2026-01-05"),
    createdBy: "private-admin-1",
    streetAddress: "Private Street 1",
    isBestValue: true,
    isTrending: false,
  },
  {
    _id: "p2",
    title: "Lakefront Villa",
    slug: "lakefront-villa",
    description: "A quiet villa with a garden",
    priceAmount: 12_000_000,
    propertyType: "Villa",
    status: "Published",
    location: { city: "Guwahati", state: "Assam", locality: "Panbazar" },
    specifications: { bedrooms: 4, bathrooms: 3, area: 2500 },
    createdAt: new Date("2026-01-04"),
    createdBy: "private-admin-2",
    streetAddress: "Private Street 2",
    isBestValue: false,
    isTrending: true,
  },
  {
    _id: "p3",
    title: "Compact Apartment",
    slug: "compact-apartment",
    description: "An urban starter home",
    priceAmount: 2_000_000,
    propertyType: "Apartment",
    status: "Published",
    location: { city: "Shillong", state: "Meghalaya", locality: "Police Bazar" },
    specifications: { bedrooms: 2, bathrooms: 1, area: 700 },
    createdAt: new Date("2026-01-03"),
    createdBy: "private-admin-3",
    streetAddress: "Private Street 3",
    isBestValue: false,
    isTrending: false,
  },
  {
    _id: "p4",
    title: "Budget Home",
    slug: "budget-home",
    description: "An affordable apartment in the city",
    priceAmount: 4_000_000,
    propertyType: "Apartment",
    status: "Published",
    location: { city: "Guwahati", state: "Assam", locality: "Six Mile" },
    specifications: { bedrooms: 3, bathrooms: 2, area: 1000 },
    createdAt: new Date("2026-01-02"),
    createdBy: "private-admin-4",
    streetAddress: "Private Street 4",
    isBestValue: true,
    isTrending: false,
  },
  ...["Draft", "Sold", "Archived"].map((status, index) => ({
    _id: `hidden-${index}`,
    title: `${status} Apartment`,
    slug: `${status.toLowerCase()}-apartment`,
    description: "Apartment in Guwahati",
    priceAmount: 5_000_000,
    propertyType: "Apartment",
    status,
    location: { city: "Guwahati", state: "Assam", locality: "Beltola" },
    specifications: { bedrooms: 3, bathrooms: 2, area: 1200 },
    createdAt: new Date("2026-01-06"),
    createdBy: "private-admin",
    streetAddress: "Private Street",
  })),
];

const originalFind = Property.find;
const originalFindOne = Property.findOne;
const originalCountDocuments = Property.countDocuments;

afterEach(() => {
  Property.find = originalFind;
  Property.findOne = originalFindOne;
  Property.countDocuments = originalCountDocuments;
});

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, value);
}

function matches(document: Fixture, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$and") {
      return (expected as Record<string, unknown>[]).every((part) => matches(document, part));
    }
    if (key === "$or") {
      return (expected as Record<string, unknown>[]).some((part) => matches(document, part));
    }

    const actual = readPath(document, key);
    if (expected instanceof RegExp) return expected.test(String(actual ?? ""));
    if (expected && typeof expected === "object") {
      const operators = expected as Record<string, number>;
      return (
        (operators.$gte === undefined || Number(actual) >= operators.$gte) &&
        (operators.$lte === undefined || Number(actual) <= operators.$lte)
      );
    }
    return actual === expected;
  });
}

type CapturedQuery = {
  filter: Record<string, unknown>;
  projection: string;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
};

let captured: CapturedQuery;
let capturedFindOneProjection = "";
let capturedFindOneFilter: Record<string, unknown> = {};

function mockPropertyQueries(): void {
  (Property as unknown as { findOne: (filter: Record<string, unknown>) => unknown }).findOne = (
    filter
  ) => {
    capturedFindOneFilter = filter;
    capturedFindOneProjection = "";
    return {
      select(projection: string) {
        capturedFindOneProjection = projection;
        return this;
      },
      async lean() {
        return fixtures.find((f) => matches(f, filter)) || null;
      },
    };
  };

  (Property as unknown as { find: (filter: Record<string, unknown>) => unknown }).find = (
    filter
  ) => {
    captured = {
      filter,
      projection: "",
      sort: {},
      skip: 0,
      limit: 0,
    };

    const query = {
      select(projection: string) {
        captured.projection = projection;
        return this;
      },
      sort(sort: Record<string, 1 | -1>) {
        captured.sort = sort;
        return this;
      },
      skip(skip: number) {
        captured.skip = skip;
        return this;
      },
      limit(limit: number) {
        captured.limit = limit;
        return this;
      },
      async lean() {
        const results = fixtures.filter((fixture) => matches(fixture, filter));
        const [[sortKey, sortDirection]] = Object.entries(captured.sort);
        results.sort((left, right) => {
          const leftValue = readPath(left, sortKey);
          const rightValue = readPath(right, sortKey);
          const comparison =
            leftValue instanceof Date && rightValue instanceof Date
              ? leftValue.getTime() - rightValue.getTime()
              : Number(leftValue) - Number(rightValue);
          if (comparison !== 0) return comparison * sortDirection;

          if (captured.sort.createdAt !== undefined && sortKey !== "createdAt") {
            return (
              (right.createdAt.getTime() - left.createdAt.getTime()) *
              captured.sort.createdAt
            );
          }
          return 0;
        });
        return results.slice(captured.skip, captured.skip + captured.limit);
      },
    };
    return query;
  };

  (Property as unknown as {
    countDocuments: (filter: Record<string, unknown>) => Promise<number>;
  }).countDocuments = async (filter) =>
    fixtures.filter((fixture) => matches(fixture, filter)).length;
}

async function request(query: Record<string, unknown> = {}) {
  mockPropertyQueries();
  const response = {
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

  await (getPublishedProperties as unknown as (
    req: Request,
    res: Response
  ) => Promise<void>)({ query } as unknown as Request, response as unknown as Response);

  return response;
}

function resultIds(response: Awaited<ReturnType<typeof request>>): string[] {
  const body = response.body as { data: Fixture[] };
  return body.data.map(({ _id }) => _id);
}

test("returns all and only published properties with public fields", async () => {
  const response = await request();
  assert.deepEqual(resultIds(response), ["p1", "p2", "p3", "p4"]);
  assert.equal(captured.filter && matches(fixtures[4], captured.filter), false);
  assert.equal(captured.projection.includes("createdBy"), false);
  assert.equal(captured.projection.includes("streetAddress"), false);
});

test("searches keyword and location case-insensitively with literal regex characters", async () => {
  assert.deepEqual(resultIds(await request({ keyword: "  APARTMENT " })), ["p1", "p3", "p4"]);
  assert.deepEqual(resultIds(await request({ location: "  gUwA " })), ["p1", "p2", "p4"]);
  assert.deepEqual(resultIds(await request({ location: "meghalaya" })), ["p3"]);
  assert.deepEqual(resultIds(await request({ location: "beltola" })), ["p1"]);
  assert.deepEqual(resultIds(await request({ keyword: "Apartment.*" })), []);
});

test("filters by property type, price, beds, baths, and area", async () => {
  assert.deepEqual(resultIds(await request({ propertyType: "villa" })), ["p2"]);
  assert.deepEqual(resultIds(await request({ minPrice: "3000000", maxPrice: "8000000" })), ["p1", "p4"]);
  assert.deepEqual(resultIds(await request({ bedrooms: "3", bathrooms: "2" })), ["p1", "p4"]);
  assert.deepEqual(resultIds(await request({ minArea: "1000", maxArea: "1500" })), ["p1", "p4"]);
});

test("sorts newest first by default and supports both price orders", async () => {
  assert.deepEqual(resultIds(await request({ sort: "newest" })), ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(resultIds(await request({ sort: "price_asc" })), ["p3", "p4", "p1", "p2"]);
  assert.deepEqual(resultIds(await request({ sort: "price_desc" })), ["p2", "p1", "p4", "p3"]);
});

test("paginates matching results and combines all supplied filters", async () => {
  const page = await request({ page: "2", limit: "2" });
  assert.deepEqual(resultIds(page), ["p3", "p4"]);
  assert.deepEqual((page.body as { pagination: unknown }).pagination, {
    total: 4,
    page: 2,
    limit: 2,
    totalPages: 2,
  });

  const combined = await request({
    keyword: "apartment",
    location: "guwahati",
    minPrice: "2000000",
    maxPrice: "8000000",
    bedrooms: "3",
    sort: "price_asc",
    page: "1",
    limit: "10",
  });
  assert.deepEqual(resultIds(combined), ["p4", "p1"]);
  assert.equal(matches(fixtures[4], captured.filter), false);
});

test("rejects invalid numeric values, ranges, limits, and sort options with 400", async () => {
  for (const query of [
    { minPrice: "-1" },
    { page: "0" },
    { bedrooms: "2.5" },
    { minPrice: "900", maxPrice: "100" },
    { minArea: "200", maxArea: "100" },
    { limit: "51" },
    { sort: "random" },
    { keyword: { $ne: "" } },
  ]) {
    const response = await request(query);
    assert.equal(response.statusCode, 400, JSON.stringify(query));
    assert.equal((response.body as { success: boolean }).success, false);
  }
});

test("returns empty data and zero total pages when there are no matches", async () => {
  const response = await request({ keyword: "no matching property" });
  assert.deepEqual(resultIds(response), []);
  assert.deepEqual((response.body as { pagination: unknown }).pagination, {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
});

test("filters by isBestValue and isTrending boolean flags", async () => {
  assert.deepEqual(resultIds(await request({ isBestValue: "true" })), ["p1", "p4"]);
  assert.deepEqual(resultIds(await request({ isTrending: "true" })), ["p2"]);
  assert.deepEqual(resultIds(await request({ isBestValue: "false" })), ["p2", "p3"]);
});

test("rejects invalid boolean query values with 400", async () => {
  for (const query of [
    { isBestValue: "not_a_boolean" },
    { isTrending: "123" },
  ]) {
    const response = await request(query);
    assert.equal(response.statusCode, 400, JSON.stringify(query));
    assert.equal((response.body as { success: boolean }).success, false);
  }
});

test("getPropertyBySlug returns published property with safe public projection", async () => {
  mockPropertyQueries();
  let statusCode = 200;
  let responseBody: unknown;

  const mockRes = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  const mockReq = {
    params: { slug: "city-view-apartment" },
  } as unknown as Request;

  await getPropertyBySlug(mockReq, mockRes, () => {});

  assert.equal(statusCode, 200);
  const data = (responseBody as { data: Fixture }).data;
  assert.equal(data.slug, "city-view-apartment");

  // Verify internal and sensitive fields are never in public projection
  assert.equal(capturedFindOneProjection.includes("createdBy"), false);
  assert.equal(capturedFindOneProjection.includes("lastUpdatedBy"), false);
  assert.equal(capturedFindOneProjection.includes("streetAddress"), false);
  assert.equal(capturedFindOneProjection.includes("cloudinaryPublicId"), false);
  assert.equal(capturedFindOneFilter.status, "Published");
});

test("getPropertyBySlug returns 404 for unpublished or nonexistent property", async () => {
  mockPropertyQueries();
  let statusCode = 200;
  let responseBody: unknown;

  const mockRes = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  // Unpublished property (Draft)
  const mockReqDraft = {
    params: { slug: "draft-apartment" },
  } as unknown as Request;

  await getPropertyBySlug(mockReqDraft, mockRes, () => {});
  assert.equal(statusCode, 404);
  assert.equal((responseBody as { success: boolean }).success, false);

  // Nonexistent property
  const mockReqNonexistent = {
    params: { slug: "does-not-exist" },
  } as unknown as Request;

  await getPropertyBySlug(mockReqNonexistent, mockRes, () => {});
  assert.equal(statusCode, 404);
  assert.equal((responseBody as { success: boolean }).success, false);
});
