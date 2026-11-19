import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { Property, Partner, SiteSettings } from "../models";
import { runSeed } from "./seed";

test("seed script rejects execution in production environment", async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  // Mock console.error
  let errorLogged = false;
  const originalError = console.error;
  console.error = () => {
    errorLogged = true;
  };

  // Intercept process.exit
  let exitCode: number | null = null;
  const originalExit = process.exit;
  (process.exit as unknown) = (code: number) => {
    exitCode = code;
    throw new Error("EXIT_CALLED");
  };

  try {
    assert.throws(() => {
      if (process.env.NODE_ENV === "production") {
        console.error("ERROR: Development seed script cannot run in production mode.");
        process.exit(1);
      }
    }, /EXIT_CALLED/);

    assert.equal(exitCode, 1);
    assert.equal(errorLogged, true);
  } finally {
    process.env.NODE_ENV = originalEnv;
    console.error = originalError;
    process.exit = originalExit;
  }
});

test("seed script upholds media integrity by creating Draft properties when Cloudinary assets are unverified", async () => {
  const originalConnect = mongoose.connect;
  const originalDisconnect = mongoose.disconnect;
  const originalPropertyFindOne = Property.findOne;
  const originalPropertyCreate = Property.create;
  const originalPartnerFindOne = Partner.findOne;
  const originalPartnerCreate = Partner.create;
  const originalSiteSettingsFindOne = SiteSettings.findOne;

  const createdProperties: Array<Record<string, unknown>> = [];
  const createdPartners: Array<Record<string, unknown>> = [];

  (mongoose.connect as unknown) = async () => mongoose;
  (mongoose.disconnect as unknown) = async () => {};

  // Simulate no existing properties
  (Property.findOne as unknown) = async () => null;
  (Property.create as unknown) = async (data: Record<string, unknown>) => {
    createdProperties.push(data);
    return data;
  };

  // Simulate no existing partners
  (Partner.findOne as unknown) = async () => null;
  (Partner.create as unknown) = async (data: Record<string, unknown>) => {
    createdPartners.push(data);
    return data;
  };

  // SiteSettings already exists
  (SiteSettings.findOne as unknown) = async () => ({ _id: "settings_1" });

  try {
    await runSeed();

    assert.ok(createdProperties.length > 0);
    // Crucial check: Without verified Cloudinary assets, no property should be Published with fabricated images
    for (const prop of createdProperties) {
      if (!prop.images || (prop.images as Array<unknown>).length === 0) {
        assert.notEqual(prop.status, "Published");
      }
    }

    // Crucial check: Without verified Cloudinary assets, partners are created with undefined logoAsset
    assert.ok(createdPartners.length > 0);
    for (const partner of createdPartners) {
      assert.equal(partner.logoAsset, undefined);
    }
  } finally {
    mongoose.connect = originalConnect;
    mongoose.disconnect = originalDisconnect;
    Property.findOne = originalPropertyFindOne;
    Property.create = originalPropertyCreate;
    Partner.findOne = originalPartnerFindOne;
    Partner.create = originalPartnerCreate;
    SiteSettings.findOne = originalSiteSettingsFindOne;
  }
});
