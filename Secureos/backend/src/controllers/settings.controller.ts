import { RequestHandler } from "express";
import { SiteSettings } from "../models";

export const getPublicSettings: RequestHandler = async (_req, res, next) => {
  try {
    let settings = await SiteSettings.findOne().lean();

    // If no settings exist in DB, provide safe defaults from model definition
    if (!settings) {
      const defaultDoc = new SiteSettings();
      settings = defaultDoc.toObject();
    }

    // Expose only approved public website settings; never leak internal metadata or storage secrets
    const publicSettings = {
      businessContact: settings.businessContact,
      socialLinks: settings.socialLinks || [],
      hero: settings.hero,
      about: settings.about,
      logoUrl: settings.logoAsset?.secureUrl || "",
      sectionVisibility: settings.sectionVisibility,
      sectionOrder: settings.sectionOrder,
    };

    res.status(200).json({
      success: true,
      data: publicSettings,
    });
  } catch (error) {
    next(error);
  }
};

