import { RequestHandler } from "express";
import { QueryFilter } from "mongoose";
import { Property, IProperty } from "../models";
import {
  adminPropertyQuerySchema,
  createPropertySchema,
  propertyObjectIdParamSchema,
  updatePropertySchema,
} from "../validators/property.validator";
import {
  verifyCloudinaryAsset,
  validatePropertyImagesIntegrity,
  cleanupRemovedCloudinaryAssets,
} from "../services/image.service";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/v1/admin/properties
 * Retrieve properties across all statuses (Draft, Published, Sold, Archived) with filters and pagination.
 */
export const getAdminProperties: RequestHandler = async (req, res, next) => {
  try {
    const queryValidation = adminPropertyQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: queryValidation.error.issues,
      });
      return;
    }

    const { status, propertyType, keyword } = queryValidation.data;
    const page = queryValidation.data.page ?? 1;
    const limit = queryValidation.data.limit ?? 10;
    const skip = (page - 1) * limit;

    const filters: QueryFilter<IProperty>[] = [];

    if (status) {
      filters.push({ status });
    }

    if (propertyType) {
      filters.push({
        propertyType: new RegExp(`^${escapeRegExp(propertyType)}$`, "i"),
      });
    }

    if (keyword) {
      const safeKeyword = new RegExp(escapeRegExp(keyword), "i");
      filters.push({
        $or: [{ title: safeKeyword }, { description: safeKeyword }],
      });
    }

    const filter: QueryFilter<IProperty> =
      filters.length === 0
        ? {}
        : filters.length === 1
          ? filters[0]
          : { $and: filters };

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: properties,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/properties/:id
 * Retrieve full property details by ID (including Draft/Archived listings and administrative metadata).
 */
export const getAdminPropertyById: RequestHandler = async (req, res, next) => {
  try {
    const paramValidation = propertyObjectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid property ID parameter",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const property = await Property.findById(paramValidation.data.id).lean();

    if (!property) {
      res.status(404).json({
        success: false,
        message: "Property not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/properties
 * Create a new property listing/draft with validated image metadata and admin audit tracking.
 */
export const createAdminProperty: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const validation = createPropertySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid property data",
        errors: validation.error.issues,
      });
      return;
    }

    // Verify all images against Cloudinary server-side metadata before saving
    if (validation.data.images && validation.data.images.length > 0) {
      for (const img of validation.data.images) {
        try {
          await verifyCloudinaryAsset(img);
        } catch (imgError: unknown) {
          res.status(400).json({
            success: false,
            message: `Image verification failed: ${
              imgError instanceof Error ? imgError.message : String(imgError)
            }`,
          });
          return;
        }
      }
    }

    const property = await Property.create({
      ...validation.data,
      createdBy: clerkUserId,
      lastUpdatedBy: clerkUserId,
    });

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "A property with this slug already exists",
      });
      return;
    }
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/properties/:id
 * Updates property details, status transitions, and featured flags.
 * Merges partial updates without destroying existing specifications or address fields.
 * Safely handles Cloudinary lifecycle for replaced or removed images.
 */
export const updateAdminProperty: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = propertyObjectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid property ID parameter",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const bodyValidation = updatePropertySchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid update data",
        errors: bodyValidation.error.issues,
      });
      return;
    }

    const property = await Property.findById(paramValidation.data.id);
    if (!property) {
      res.status(404).json({
        success: false,
        message: "Property not found",
      });
      return;
    }

    const updates = bodyValidation.data;

    // Verify any new images against Cloudinary server-side metadata before saving
    if (updates.images && updates.images.length > 0) {
      for (const img of updates.images) {
        try {
          await verifyCloudinaryAsset(img);
        } catch (imgError: unknown) {
          res.status(400).json({
            success: false,
            message: `Image verification failed: ${
              imgError instanceof Error ? imgError.message : String(imgError)
            }`,
          });
          return;
        }
      }
    }

    // Validate publishing image constraints across effective status and images
    const effectiveStatus =
      updates.status !== undefined ? updates.status : property.status;
    const effectiveImages =
      updates.images !== undefined ? updates.images : property.images;

    if (effectiveStatus === "Published") {
      try {
        validatePropertyImagesIntegrity(effectiveImages, "Published");
      } catch (integrityError: unknown) {
        res.status(400).json({
          success: false,
          message:
            integrityError instanceof Error
              ? integrityError.message
              : String(integrityError),
        });
        return;
      }
    }

    // Check slug collision if slug is being modified
    if (updates.slug && updates.slug !== property.slug) {
      const existingSlug = await Property.findOne({ slug: updates.slug });
      if (existingSlug) {
        res.status(409).json({
          success: false,
          message: "A property with this slug already exists",
        });
        return;
      }
      property.slug = updates.slug;
    }

    // Snapshot existing images before updating document
    const oldImages = property.images ? [...property.images] : [];

    // Apply primitive updates
    if (updates.title !== undefined) property.title = updates.title;
    if (updates.description !== undefined)
      property.description = updates.description;
    if (updates.priceAmount !== undefined)
      property.priceAmount = updates.priceAmount;
    if (updates.currency !== undefined) property.currency = updates.currency;
    if (updates.propertyType !== undefined)
      property.propertyType = updates.propertyType;
    if (updates.status !== undefined) property.status = updates.status;
    if (updates.isBestValue !== undefined)
      property.isBestValue = updates.isBestValue;
    if (updates.isTrending !== undefined)
      property.isTrending = updates.isTrending;
    if (updates.amenities !== undefined) property.amenities = updates.amenities;
    if (updates.images !== undefined) property.images = updates.images;

    // Safely merge nested objects without overwriting unsupplied sub-fields
    if (updates.location) {
      property.location = {
        ...property.location,
        ...updates.location,
      };
    }

    if (updates.specifications) {
      property.specifications = {
        ...property.specifications,
        ...updates.specifications,
      };
    }

    property.lastUpdatedBy = clerkUserId;

    // 1. Successfully update and save property document FIRST
    await property.save();

    // 2. Safe asset lifecycle: clean up unreferenced Cloudinary assets ONLY after DB update succeeds
    if (updates.images !== undefined) {
      cleanupRemovedCloudinaryAssets(
        property._id,
        oldImages,
        property.images
      ).catch((cleanupErr) =>
        console.error("Background Cloudinary cleanup error:", cleanupErr)
      );
    }

    res.status(200).json({
      success: true,
      message: "Property updated successfully",
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/admin/properties/:id
 * Archives property rather than permanently deleting it (FR-ADM-009, SRS Section 9.2 & Requirement 7).
 * Preserves all media assets and relational records.
 */
export const archiveAdminProperty: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = propertyObjectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid property ID parameter",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const property = await Property.findByIdAndUpdate(
      paramValidation.data.id,
      {
        status: "Archived",
        lastUpdatedBy: clerkUserId,
      },
      { new: true }
    );

    if (!property) {
      res.status(404).json({
        success: false,
        message: "Property not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Property archived successfully",
      data: {
        _id: property._id,
        status: property.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
