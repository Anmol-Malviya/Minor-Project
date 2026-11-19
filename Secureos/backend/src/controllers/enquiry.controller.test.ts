import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { Property, Enquiry } from "../models";
import { createEnquiry } from "./enquiry.controller";

const validPropertyId = "507f1f77bcf86cd799439011";

const originalPropertyFindOne = Property.findOne;
const originalEnquiryCreate = Enquiry.create;

afterEach(() => {
  Property.findOne = originalPropertyFindOne;
  Enquiry.create = originalEnquiryCreate;
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
    locals: {},
  };
  return res;
}

test("creates guest enquiry with status 'New' and without exposing internal notes", async () => {
  let createdPayload: Record<string, unknown> = {};

  (Property as unknown as { findOne: (filter: unknown) => unknown }).findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return { _id: validPropertyId, title: "Lakefront Villa", status: "Published" };
    },
  });

  (Enquiry as unknown as { create: (doc: unknown) => unknown }).create = async (doc) => {
    createdPayload = doc as Record<string, unknown>;
    return {
      _id: "enq_123",
      propertyId: validPropertyId,
      name: "Guest Visitor",
      email: "guest@example.com",
      phone: "+91 98765 43210",
      message: "I am interested in this villa.",
      status: "New",
      internalNotes: "",
      createdAt: new Date(),
    };
  };

  const req = {
    body: {
      propertyId: validPropertyId,
      name: "Guest Visitor",
      email: "guest@example.com",
      phone: "+91 98765 43210",
      message: "I am interested in this villa.",
      // Client attempting to sneak administrative fields
      status: "Closed",
      internalNotes: "Hack attempt",
      lastUpdatedBy: "malicious-admin",
    },
  } as unknown as Request;

  const res = createMockResponse();

  await createEnquiry(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 201);
  const responseData = (res.body as { data: Record<string, unknown> }).data;

  // Verify guest submission has no clerkUserId
  assert.equal(createdPayload.clerkUserId, undefined);
  // Verify client cannot override status to Closed
  assert.equal(createdPayload.status, "New");
  // Verify client cannot set internal notes
  assert.equal(createdPayload.internalNotes, "");
  // Verify internalNotes is not returned in response
  assert.equal("internalNotes" in responseData, false);
});

test("associates clerkUserId when authenticated user submits an enquiry", async () => {
  let createdPayload: Record<string, unknown> = {};

  (Property as unknown as { findOne: (filter: unknown) => unknown }).findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return { _id: validPropertyId, title: "Lakefront Villa", status: "Published" };
    },
  });

  (Enquiry as unknown as { create: (doc: unknown) => unknown }).create = async (doc) => {
    createdPayload = doc as Record<string, unknown>;
    return {
      _id: "enq_456",
      propertyId: validPropertyId,
      clerkUserId: "user_verified_99",
      name: "Logged In User",
      email: "user@example.com",
      phone: "+91 98765 43210",
      message: "Please schedule a site visit.",
      status: "New",
      createdAt: new Date(),
    };
  };

  const req = {
    body: {
      propertyId: validPropertyId,
      name: "Logged In User",
      email: "user@example.com",
      phone: "+91 98765 43210",
      message: "Please schedule a site visit.",
    },
  } as unknown as Request;

  const res = createMockResponse();
  // Populated by optionalAuth middleware when session token is verified
  res.locals = { auth: { clerkUserId: "user_verified_99", role: "USER" } };

  await createEnquiry(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(createdPayload.clerkUserId, "user_verified_99");
});

test("rejects enquiry for nonexistent or unpublished property with 404", async () => {
  (Property as unknown as { findOne: (filter: unknown) => unknown }).findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return null; // Property not found or status is Draft/Archived
    },
  });

  const req = {
    body: {
      propertyId: validPropertyId,
      name: "Visitor",
      email: "visitor@example.com",
      phone: "+91 98765 43210",
      message: "Looking for details on this property.",
    },
  } as unknown as Request;

  const res = createMockResponse();

  await createEnquiry(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 404);
  assert.equal((res.body as { success: boolean }).success, false);
});

test("rejects invalid enquiry payload with 400", async () => {
  for (const invalidBody of [
    // Invalid property ID format
    { propertyId: "short", name: "A", email: "bad-email", phone: "123", message: "short" },
    // Missing required fields
    { name: "Only Name" },
    // Short phone
    { propertyId: validPropertyId, name: "Name", email: "a@b.com", phone: "123", message: "Long message here" },
    // Short message
    { propertyId: validPropertyId, name: "Name", email: "a@b.com", phone: "+91 9876543210", message: "Hi" },
  ]) {
    const req = { body: invalidBody } as unknown as Request;
    const res = createMockResponse();
    await createEnquiry(req, res as unknown as Response, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal((res.body as { success: boolean }).success, false);
  }
});

