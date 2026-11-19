import { RequestHandler } from "express";
import { SiteSettings, AuditLog } from "../models";
import { updateSiteSettingsSchema } from "../validators/admin.validator";
import { verifyCloudinaryAsset } from "../services/image.service";

/**
 * GET /api/v1/admin/settings
 * Retrieve full website configuration and section controls for administrative management (FR-ADM-023).
 */
export const getAdminSettings: RequestHandler = async (_req, res, next) => {
  try {
    let settings = await SiteSettings.findOne().lean();

    if (!settings) {
      const defaultDoc = new SiteSettings();
      settings = defaultDoc.toObject();
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/settings
 * Update website content, contact info, section visibility, ordering, and branding logo (FR-ADM-023, FR-ADM-024).
 * Validates logo image against Cloudinary server-side before persisting.
 * Tracks administrator identity and logs changes to AuditLog.
 */
export const updateAdminSettings: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const validation = updateSiteSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid site settings data",
        errors: validation.error.issues,
      });
      return;
    }

    const {
      businessContact,
      socialLinks,
      hero,
      about,
      logoAsset,
      sectionVisibility,
      sectionOrder,
    } = validation.data;

    // Verify logo asset against Cloudinary server-side metadata if provided
    if (logoAsset) {
      try {
        await verifyCloudinaryAsset(logoAsset);
      } catch (assetError: unknown) {
        res.status(400).json({
          success: false,
          message: `Logo asset verification failed: ${
            assetError instanceof Error ? assetError.message : String(assetError)
          }`,
        });
        return;
      }
    }

    let settings = await SiteSettings.findOne();
    if (!settings) {
      settings = new SiteSettings();
    }

    if (businessContact) {
      settings.businessContact = {
        phone: businessContact.phone ?? settings.businessContact.phone,
        email: businessContact.email ?? settings.businessContact.email,
        address: businessContact.address ?? settings.businessContact.address,
        workingHours:
          businessContact.workingHours ?? settings.businessContact.workingHours,
      };
    }

    if (socialLinks !== undefined) {
      settings.socialLinks = socialLinks;
    }

    if (hero) {
      settings.hero = {
        headline: hero.headline ?? settings.hero.headline,
        description: hero.description ?? settings.hero.description,
        ctaText: hero.ctaText ?? settings.hero.ctaText,
      };
    }

    if (about) {
      settings.about = {
        title: about.title ?? settings.about.title,
        content: about.content ?? settings.about.content,
      };
    }

    if (logoAsset !== undefined) {
      settings.logoAsset = logoAsset;
    }

    if (sectionVisibility) {
      settings.sectionVisibility = {
        showBestValue:
          sectionVisibility.showBestValue ??
          settings.sectionVisibility.showBestValue,
        showTrending:
          sectionVisibility.showTrending ??
          settings.sectionVisibility.showTrending,
        showAbout:
          sectionVisibility.showAbout ?? settings.sectionVisibility.showAbout,
        showPartners:
          sectionVisibility.showPartners ??
          settings.sectionVisibility.showPartners,
      };
    }

    if (sectionOrder !== undefined) {
      settings.sectionOrder = sectionOrder;
    }

    settings.updatedBy = clerkUserId;
    await settings.save();

    // Log administrative action in AuditLog
    await AuditLog.create({
      actorClerkUserId: clerkUserId,
      action: "UPDATE_SITE_SETTINGS",
      entityType: "SiteSettings",
      entityId: settings._id.toString(),
      changeSummary: {
        updatedFields: Object.keys(validation.data),
      },
    });

    res.status(200).json({
      success: true,
      message: "Site settings updated successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

