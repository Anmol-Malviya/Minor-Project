import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { SiteSettings } from "../models";
import { getPublicSettings } from "./settings.controller";

const originalSiteSettingsFindOne = SiteSettings.findOne;

afterEach(() => {
  SiteSettings.findOne = originalSiteSettingsFindOne;
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

test("returns public settings projection and hides internal identifiers", async () => {
  (SiteSettings as unknown as { findOne: () => unknown }).findOne = () => ({
    async lean() {
      return {
        businessContact: {
          phone: "+91 99999 88888",
          email: "contact@realitydreams.com",
          address: "Guwahati, Assam",
          workingHours: "9am - 6pm",
        },
        socialLinks: [{ platform: "Instagram", url: "https://instagram.com/realitydreams" }],
        hero: {
          headline: "Discover Quality Properties",
          description: "Curated real estate listings.",
          ctaText: "Browse Listings",
        },
        about: {
          title: "About Us",
          content: "We provide trusted property listings.",
        },
        logoAsset: {
          secureUrl: "https://res.cloudinary.com/reality-dreams/image/upload/v1/logo.png",
          cloudinaryPublicId: "reality-dreams/private_logo_id",
        },
        sectionVisibility: {
          showBestValue: true,
          showTrending: true,
          showAbout: true,
          showPartners: false,
        },
        sectionOrder: ["trending", "bestValue", "about", "partners"],
        updatedBy: "admin_secret_id",
      };
    },
  });

  const req = {} as Request;
  const res = createMockResponse();

  await getPublicSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const data = (res.body as { data: Record<string, unknown> }).data;

  assert.equal(data.logoUrl, "https://res.cloudinary.com/reality-dreams/image/upload/v1/logo.png");
  assert.deepEqual(data.sectionOrder, ["trending", "bestValue", "about", "partners"]);
  assert.equal("updatedBy" in data, false);
  assert.equal("cloudinaryPublicId" in data, false);
});

test("returns default settings gracefully when no SiteSettings document exists in DB", async () => {
  (SiteSettings as unknown as { findOne: () => unknown }).findOne = () => ({
    async lean() {
      return null;
    },
  });

  const req = {} as Request;
  const res = createMockResponse();

  await getPublicSettings(req, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  const data = (res.body as { data: { hero: { headline: string }; sectionOrder: string[] } }).data;

  assert.ok(data.hero.headline);
  assert.deepEqual(data.sectionOrder, ["bestValue", "trending", "about", "partners"]);
});

