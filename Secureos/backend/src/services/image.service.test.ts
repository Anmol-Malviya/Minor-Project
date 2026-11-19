import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import cloudinary from "../config/cloudinary";
import Property from "../models/Property";
import Partner from "../models/Partner";
import SiteSettings from "../models/SiteSettings";
import AuditLog from "../models/AuditLog";
import {
  verifyCloudinaryAsset,
  validatePropertyImagesIntegrity,
  cleanupRemovedCloudinaryAssets,
  MAX_IMAGE_FILE_SIZE_BYTES,
} from "./image.service";

const originalCloudinaryResource = cloudinary.api.resource;
const originalCloudinaryDestroy = cloudinary.uploader.destroy;
const originalPropertyFindOne = Property.findOne;
const originalPartnerFindOne = Partner.findOne;
const originalSiteSettingsFindOne = SiteSettings.findOne;
const originalAuditLogCreate = AuditLog.create;

beforeEach(() => {
  (Partner as unknown as { findOne: () => unknown }).findOne = () => ({
    select: () => ({ lean: async () => null }),
  });
  (SiteSettings as unknown as { findOne: () => unknown }).findOne = () => ({
    select: () => ({ lean: async () => null }),
  });
  (AuditLog as unknown as { create: () => unknown }).create = async () => null;
});

afterEach(() => {
  cloudinary.api.resource = originalCloudinaryResource;
  cloudinary.uploader.destroy = originalCloudinaryDestroy;
  Property.findOne = originalPropertyFindOne;
  Partner.findOne = originalPartnerFindOne;
  SiteSettings.findOne = originalSiteSettingsFindOne;
  AuditLog.create = originalAuditLogCreate;
});

test("verifyCloudinaryAsset rejects invalid public IDs outside properties folder", async () => {
  await assert.rejects(
    async () => {
      await verifyCloudinaryAsset({
        secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/pic.jpg",
        cloudinaryPublicId: "malicious-folder/pic",
      });
    },
    { message: /Must belong to the 'reality-dreams\/properties' folder/ }
  );
});

test("verifyCloudinaryAsset rejects external non-Cloudinary URLs", async () => {
  await assert.rejects(
    async () => {
      await verifyCloudinaryAsset({
        secureUrl: "https://external-untrusted-site.com/image.jpg",
        cloudinaryPublicId: "reality-dreams/properties/valid_id",
      });
    },
    { message: /Only secure Cloudinary URLs/ }
  );
});

test("verifyCloudinaryAsset rejects unsupported formats (e.g. gif or bmp)", async () => {
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource = async () => ({
    public_id: "reality-dreams/properties/animation",
    format: "gif",
    resource_type: "image",
    bytes: 200000,
    secure_url: "https://res.cloudinary.com/reality-dreams/image/upload/v1/animation.gif",
  });

  await assert.rejects(
    async () => {
      await verifyCloudinaryAsset({
        secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/animation.gif",
        cloudinaryPublicId: "reality-dreams/properties/animation",
      });
    },
    { message: /Unsupported image format 'gif'/ }
  );
});

test("verifyCloudinaryAsset rejects oversized uploads exceeding 10MB", async () => {
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource = async () => ({
    public_id: "reality-dreams/properties/huge_file",
    format: "jpg",
    resource_type: "image",
    bytes: MAX_IMAGE_FILE_SIZE_BYTES + 1024, // 10MB + 1KB
    secure_url: "https://res.cloudinary.com/reality-dreams/image/upload/v1/huge_file.jpg",
  });

  await assert.rejects(
    async () => {
      await verifyCloudinaryAsset({
        secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/huge_file.jpg",
        cloudinaryPublicId: "reality-dreams/properties/huge_file",
      });
    },
    { message: /exceeds maximum limit of 10MB/ }
  );
});

test("verifyCloudinaryAsset rejects non-image resource types", async () => {
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource = async () => ({
    public_id: "reality-dreams/properties/video_clip",
    format: "mp4",
    resource_type: "video",
    bytes: 500000,
    secure_url: "https://res.cloudinary.com/reality-dreams/image/upload/v1/video_clip.mp4",
  });

  await assert.rejects(
    async () => {
      await verifyCloudinaryAsset({
        secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/video_clip.mp4",
        cloudinaryPublicId: "reality-dreams/properties/video_clip",
      });
    },
    { message: /Uploaded asset must be an image/ }
  );
});

test("verifyCloudinaryAsset rejects mismatched secure URLs", async () => {
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource = async () => ({
    public_id: "reality-dreams/properties/photo",
    format: "jpg",
    resource_type: "image",
    bytes: 350000,
    secure_url: "https://res.cloudinary.com/reality-dreams/image/upload/v1/authentic_url.jpg",
  });

  await assert.rejects(
    async () => {
      await verifyCloudinaryAsset({
        secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/spoofed_url.jpg",
        cloudinaryPublicId: "reality-dreams/properties/photo",
      });
    },
    { message: /does not match the verified Cloudinary asset URL/ }
  );
});

test("verifyCloudinaryAsset succeeds for valid verified Cloudinary assets", async () => {
  const verifiedUrl = "https://res.cloudinary.com/reality-dreams/image/upload/v1/photo.webp";
  (cloudinary.api as unknown as { resource: (id: string) => unknown }).resource = async () => ({
    public_id: "reality-dreams/properties/photo",
    format: "webp",
    resource_type: "image",
    bytes: 450000,
    secure_url: verifiedUrl,
  });

  const res = await verifyCloudinaryAsset({
    secureUrl: verifiedUrl,
    cloudinaryPublicId: "reality-dreams/properties/photo",
  });

  assert.equal(res.public_id, "reality-dreams/properties/photo");
  assert.equal(res.format, "webp");
});

test("validatePropertyImagesIntegrity rejects duplicate image public IDs and URLs", () => {
  // Duplicate public ID
  assert.throws(
    () => {
      validatePropertyImagesIntegrity([
        { secureUrl: "https://res.cloudinary.com/rd/1.jpg", cloudinaryPublicId: "p1", isPrimary: true },
        { secureUrl: "https://res.cloudinary.com/rd/2.jpg", cloudinaryPublicId: "p1" },
      ]);
    },
    { message: /Duplicate image reference detected: public ID 'p1'/ }
  );

  // Duplicate URL
  assert.throws(
    () => {
      validatePropertyImagesIntegrity([
        { secureUrl: "https://res.cloudinary.com/rd/same.jpg", cloudinaryPublicId: "p1", isPrimary: true },
        { secureUrl: "https://res.cloudinary.com/rd/same.jpg", cloudinaryPublicId: "p2" },
      ]);
    },
    { message: /Duplicate image reference detected: URL/ }
  );
});

test("validatePropertyImagesIntegrity rejects multiple primary images and invalid published images", () => {
  // Multiple primary images
  assert.throws(
    () => {
      validatePropertyImagesIntegrity([
        { secureUrl: "https://res.cloudinary.com/rd/1.jpg", cloudinaryPublicId: "p1", isPrimary: true },
        { secureUrl: "https://res.cloudinary.com/rd/2.jpg", cloudinaryPublicId: "p2", isPrimary: true },
      ]);
    },
    { message: /A property cannot have more than one primary image/ }
  );

  // Published without primary image
  assert.throws(
    () => {
      validatePropertyImagesIntegrity(
        [{ secureUrl: "https://res.cloudinary.com/rd/1.jpg", cloudinaryPublicId: "p1", isPrimary: false }],
        "Published"
      );
    },
    { message: /Published properties must have exactly one primary image/ }
  );

  // Published with empty images
  assert.throws(
    () => {
      validatePropertyImagesIntegrity([], "Published");
    },
    { message: /Published properties must have at least one image/ }
  );
});

test("cleanupRemovedCloudinaryAssets protects shared assets and deletes unreferenced assets", async () => {
  const deletedAssets: string[] = [];
  (cloudinary.uploader as unknown as { destroy: (id: string) => unknown }).destroy = async (id) => {
    deletedAssets.push(id);
    return { result: "ok" };
  };

  // Mock Property.findOne: p_shared is referenced elsewhere, p_unshared is not
  (Property as unknown as { findOne: (filter: unknown) => unknown }).findOne = (filter) => ({
    select() {
      return this;
    },
    async lean() {
      const query = filter as { "images.cloudinaryPublicId": string };
      if (query["images.cloudinaryPublicId"] === "reality-dreams/properties/shared_asset") {
        return { _id: "other_property_id" };
      }
      return null;
    },
  });

  const oldImages = [
    { cloudinaryPublicId: "reality-dreams/properties/retained_asset" },
    { cloudinaryPublicId: "reality-dreams/properties/shared_asset" },
    { cloudinaryPublicId: "reality-dreams/properties/unshared_asset" },
  ];

  const newImages = [
    { cloudinaryPublicId: "reality-dreams/properties/retained_asset" },
    { cloudinaryPublicId: "reality-dreams/properties/brand_new_asset" },
  ];

  await cleanupRemovedCloudinaryAssets("current_property_id", oldImages, newImages);

  // Only unshared_asset should be destroyed
  assert.deepEqual(deletedAssets, ["reality-dreams/properties/unshared_asset"]);
});

test("cleanupRemovedCloudinaryAssets handles Cloudinary deletion failures safely without throwing", async () => {
  (cloudinary.uploader as unknown as { destroy: () => unknown }).destroy = async () => {
    throw new Error("Cloudinary rate limit or network timeout");
  };

  (Property as unknown as { findOne: () => unknown }).findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return null;
    },
  });

  const oldImages = [{ cloudinaryPublicId: "reality-dreams/properties/asset_err" }];
  const newImages: { cloudinaryPublicId: string }[] = [];

  // Must not throw an unhandled rejection
  await assert.doesNotReject(async () => {
    await cleanupRemovedCloudinaryAssets("current_property_id", oldImages, newImages);
  });
});

test("cleanupRemovedCloudinaryAssets does not delete asset if shared with Partner or SiteSettings", async () => {
  const deletedAssets: string[] = [];
  (cloudinary.uploader as unknown as { destroy: (id: string) => unknown }).destroy = async (id) => {
    deletedAssets.push(id);
    return { result: "ok" };
  };

  (Property as unknown as { findOne: () => unknown }).findOne = () => ({
    select: () => ({ lean: async () => null }),
  });

  // Partner references asset_partner
  (Partner as unknown as { findOne: (filter: unknown) => unknown }).findOne = (filter) => ({
    select: () => ({
      lean: async () => {
        const q = filter as { "logoAsset.cloudinaryPublicId": string };
        if (q["logoAsset.cloudinaryPublicId"] === "reality-dreams/properties/asset_partner") {
          return { _id: "partner_1" };
        }
        return null;
      },
    }),
  });

  // SiteSettings references asset_site
  (SiteSettings as unknown as { findOne: (filter: unknown) => unknown }).findOne = (filter) => ({
    select: () => ({
      lean: async () => {
        const q = filter as { "logoAsset.cloudinaryPublicId": string };
        if (q["logoAsset.cloudinaryPublicId"] === "reality-dreams/properties/asset_site") {
          return { _id: "settings_1" };
        }
        return null;
      },
    }),
  });

  const oldImages = [
    { cloudinaryPublicId: "reality-dreams/properties/asset_partner" },
    { cloudinaryPublicId: "reality-dreams/properties/asset_site" },
    { cloudinaryPublicId: "reality-dreams/properties/asset_unshared" },
  ];

  await cleanupRemovedCloudinaryAssets("current_property_id", oldImages, []);

  // Only the unshared asset should be deleted
  assert.deepEqual(deletedAssets, ["reality-dreams/properties/asset_unshared"]);
});

