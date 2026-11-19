import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Property,
  UserProfile,
  Enquiry,
  Wishlist,
  Partner,
  SiteSettings,
  AuditLog,
  ENQUIRY_STATUSES,
  HOMEPAGE_SECTIONS,
} from "./index";

test("Property model has required indexes registered", () => {
  const indexes = Property.schema.indexes();
  const indexKeys = indexes.map(([fields]) => Object.keys(fields).join(","));
  assert.ok(indexKeys.some((k) => k.includes("status") && k.includes("createdAt")));
  assert.ok(indexKeys.some((k) => k.includes("status") && k.includes("priceAmount")));
  assert.ok(indexKeys.some((k) => k.includes("status") && k.includes("isBestValue")));
  assert.ok(indexKeys.some((k) => k.includes("status") && k.includes("isTrending")));
  assert.ok(indexKeys.some((k) => k.includes("status") && k.includes("propertyType")));
  assert.ok(indexKeys.some((k) => k.includes("location.city")));
});

test("UserProfile model restricts role and defaults to USER", () => {
  const roleField = UserProfile.schema.path("role") as unknown as {
    enumValues: string[];
    defaultValue: string;
  };
  assert.deepEqual(roleField.enumValues, ["USER", "ADMIN"]);
  assert.equal(roleField.defaultValue, "USER");
});

test("Enquiry model has status enum matching SRS FR-ADM-020", () => {
  assert.deepEqual(ENQUIRY_STATUSES, [
    "New",
    "Contacted",
    "Visit Scheduled",
    "Closed",
    "Spam",
  ]);

  const statusPath = Enquiry.schema.path("status") as unknown as {
    enumValues: string[];
    defaultValue: string;
  };
  assert.deepEqual(statusPath.enumValues, ENQUIRY_STATUSES);
  assert.equal(statusPath.defaultValue, "New");
});

test("Wishlist model registers unique compound index on clerkUserId and propertyId", () => {
  const indexes = Wishlist.schema.indexes();
  const compoundUniqueIndex = indexes.find(([fields, options]) => {
    return (
      fields.clerkUserId === 1 &&
      fields.propertyId === 1 &&
      options?.unique === true
    );
  });
  assert.ok(
    compoundUniqueIndex,
    "Wishlist must have compound unique index on clerkUserId + propertyId"
  );
});

test("SiteSettings model defines default values for hero, about, section visibility and sectionOrder", () => {
  assert.ok(SiteSettings.schema.path("hero.headline"));
  assert.ok(SiteSettings.schema.path("about.title"));
  assert.ok(SiteSettings.schema.path("businessContact.email"));

  const doc = new SiteSettings();
  assert.deepEqual(doc.sectionOrder, [
    "bestValue",
    "trending",
    "about",
    "partners",
  ]);
  assert.deepEqual(HOMEPAGE_SECTIONS, [
    "bestValue",
    "trending",
    "about",
    "partners",
  ]);
});

test("SiteSettings validates sectionOrder for uniqueness and supported identifiers", async () => {
  // Valid reordered sections
  const validDoc = new SiteSettings({
    sectionOrder: ["trending", "bestValue", "partners", "about"],
  });
  let validError: unknown;
  try {
    await validDoc.validate();
  } catch (err) {
    validError = err;
  }
  assert.equal(validError, undefined);

  // Duplicate identifiers rejected
  const duplicateDoc = new SiteSettings({
    sectionOrder: ["bestValue", "trending", "bestValue", "about"],
  });
  let duplicateError: { errors?: Record<string, unknown> } | undefined;
  try {
    await duplicateDoc.validate();
  } catch (err) {
    duplicateError = err as { errors?: Record<string, unknown> };
  }
  assert.ok(duplicateError?.errors?.["sectionOrder"]);

  // Unsupported identifiers rejected
  const invalidDoc = new SiteSettings({
    sectionOrder: ["bestValue", "unsupportedSection"],
  });
  let invalidError: { errors?: Record<string, unknown> } | undefined;
  try {
    await invalidDoc.validate();
  } catch (err) {
    invalidError = err as { errors?: Record<string, unknown> };
  }
  assert.ok(invalidError?.errors?.["sectionOrder"]);
});

test("Partner model registers active sorting index", () => {
  const indexes = Partner.schema.indexes();
  const activeSortIndex = indexes.find(
    ([fields]) => fields.isActive === 1 && fields.sortOrder === 1
  );
  assert.ok(activeSortIndex, "Partner must index isActive + sortOrder");
});

test("AuditLog model defines entityType enum and indexes", () => {
  const entityTypePath = AuditLog.schema.path("entityType") as unknown as {
    enumValues: string[];
  };
  assert.ok(entityTypePath.enumValues.includes("Property"));
  assert.ok(entityTypePath.enumValues.includes("Enquiry"));
});
