import { RequestHandler } from "express";
import { Partner, AuditLog } from "../models";
import {
  objectIdParamSchema,
  createPartnerSchema,
  updatePartnerSchema,
} from "../validators/admin.validator";
import { verifyCloudinaryAsset } from "../services/image.service";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/v1/admin/partners
 * Retrieve all partners (active & inactive) for administrative management.
 */
export const getAdminPartners: RequestHandler = async (_req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const partners = await Partner.find()
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: partners,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/partners
 * Create a new partner with validated logo asset, website URL, and sort order.
 * Verifies logo asset with Cloudinary before creating.
 * Logs action to AuditLog.
 */
export const createAdminPartner: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const validation = createPartnerSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid partner data",
        errors: validation.error.issues,
      });
      return;
    }

    const { name, logoAsset, websiteUrl, sortOrder, isActive } = validation.data;

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

    // Check for duplicate partner name
    const existing = await Partner.findOne({
      name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `A partner named '${name}' already exists`,
      });
      return;
    }

    const partner = await Partner.create({
      name,
      logoAsset,
      websiteUrl: websiteUrl || undefined,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    });

    // Log administrative action
    await AuditLog.create({
      actorClerkUserId: clerkUserId,
      action: "CREATE_PARTNER",
      entityType: "Partner",
      entityId: partner._id.toString(),
      changeSummary: {
        name: partner.name,
        sortOrder: partner.sortOrder,
        isActive: partner.isActive,
      },
    });

    res.status(201).json({
      success: true,
      message: "Partner created successfully",
      data: partner,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/partners/:id
 * Update partner details, logo asset, or ordering.
 * Verifies new logo asset with Cloudinary if provided.
 * Logs action to AuditLog.
 */
export const updateAdminPartner: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = objectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid partner ID format",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const bodyValidation = updatePartnerSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid partner update data",
        errors: bodyValidation.error.issues,
      });
      return;
    }

    if (Object.keys(bodyValidation.data).length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one field must be provided for update",
      });
      return;
    }

    const partner = await Partner.findById(paramValidation.data.id);
    if (!partner) {
      res.status(404).json({
        success: false,
        message: "Partner not found",
      });
      return;
    }

    const { name, logoAsset, websiteUrl, sortOrder, isActive } = bodyValidation.data;

    // Verify new logo asset if provided
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
      partner.logoAsset = logoAsset;
    }

    // Check duplicate name if name changed
    if (name && name.toLowerCase() !== partner.name.toLowerCase()) {
      const duplicate = await Partner.findOne({
        _id: { $ne: partner._id },
        name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
      });

      if (duplicate) {
        res.status(409).json({
          success: false,
          message: `A partner named '${name}' already exists`,
        });
        return;
      }
      partner.name = name;
    }

    if (websiteUrl !== undefined) {
      partner.websiteUrl = websiteUrl || undefined;
    }

    if (sortOrder !== undefined) {
      partner.sortOrder = sortOrder;
    }

    if (isActive !== undefined) {
      partner.isActive = isActive;
    }

    await partner.save();

    // Log administrative action
    await AuditLog.create({
      actorClerkUserId: clerkUserId,
      action: "UPDATE_PARTNER",
      entityType: "Partner",
      entityId: partner._id.toString(),
      changeSummary: bodyValidation.data,
    });

    res.status(200).json({
      success: true,
      message: "Partner updated successfully",
      data: partner,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/partners/:id
 * Deactivates a partner (soft deletion / status change) rather than permanently deleting.
 * Logs action to AuditLog.
 */
export const deactivateAdminPartner: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = objectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid partner ID format",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const partner = await Partner.findById(paramValidation.data.id);
    if (!partner) {
      res.status(404).json({
        success: false,
        message: "Partner not found",
      });
      return;
    }

    partner.isActive = false;
    await partner.save();

    // Log administrative action
    await AuditLog.create({
      actorClerkUserId: clerkUserId,
      action: "DEACTIVATE_PARTNER",
      entityType: "Partner",
      entityId: partner._id.toString(),
      changeSummary: { previousStatus: true, isActive: false },
    });

    res.status(200).json({
      success: true,
      message: "Partner deactivated successfully",
      data: partner,
    });
  } catch (error) {
    next(error);
  }
};

