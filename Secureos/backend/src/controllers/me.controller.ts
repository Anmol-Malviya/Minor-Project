import { RequestHandler } from "express";
import { Types } from "mongoose";
import { Property, Enquiry, Wishlist } from "../models";
import {
  mePaginationQuerySchema,
  propertyIdParamSchema,
} from "../validators/me.validator";

/**
 * GET /api/v1/me/enquiries
 * Retrieves submitted enquiries belonging strictly to the authenticated user.
 * Explicitly strips internalNotes and administrator metadata (FR-USR-003, AT-05, AT-07).
 */
export const getMyEnquiries: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const queryValidation = mePaginationQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: queryValidation.error.issues,
      });
      return;
    }

    const page = queryValidation.data.page ?? 1;
    const limit = queryValidation.data.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter = { clerkUserId };

    // Explicitly omit internalNotes and lastUpdatedBy
    const userSafeEnquiryFields = "propertyId name email phone message status createdAt updatedAt";

    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter)
        .select(userSafeEnquiryFields)
        .populate({
          path: "propertyId",
          select:
            "title slug priceAmount currency propertyType status location.locality location.city images.secureUrl images.altText images.isPrimary",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Enquiry.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: enquiries,
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
 * GET /api/v1/me/wishlist
 * Retrieves saved properties belonging strictly to the authenticated user.
 * Populates only safe, published property information (FR-USR-002, FR-USR-004).
 */
export const getMyWishlist: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const queryValidation = mePaginationQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: queryValidation.error.issues,
      });
      return;
    }

    const page = queryValidation.data.page ?? 1;
    const limit = queryValidation.data.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter = { clerkUserId };

    // Explicitly exclude internal Cloudinary IDs, createdBy, and streetAddress
    const safePropertyFields =
      "title slug priceAmount currency propertyType status location.locality location.city location.state specifications.area specifications.areaUnit specifications.bedrooms specifications.bathrooms images.secureUrl images.altText images.sortOrder images.isPrimary isBestValue isTrending";

    const [wishlistItems, total] = await Promise.all([
      Wishlist.find(filter)
        .populate({
          path: "propertyId",
          select: safePropertyFields,
          // Only populate if still published; handles unlisted/archived listings safely
          match: { status: "Published" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Wishlist.countDocuments(filter),
    ]);

    // Format items and filter out entries where property is no longer published
    const validItems = wishlistItems.filter((item) => item.propertyId !== null);

    res.status(200).json({
      success: true,
      data: validItems,
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
 * POST /api/v1/me/wishlist/:propertyId
 * Adds a published property to the authenticated user's wishlist (FR-USR-004, FR-USR-005).
 * Enforces duplicate prevention via compound index and returns 409 on duplicates.
 */
export const addToWishlist: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = propertyIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid property ID parameter",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const { propertyId } = paramValidation.data;

    // Verify property exists and is Published (rejects Draft, Sold, Archived)
    const property = await Property.findOne({
      _id: propertyId,
      status: "Published",
    })
      .select("_id title status")
      .lean();

    if (!property) {
      res.status(404).json({
        success: false,
        message: "Property not found or unavailable for wishlist",
      });
      return;
    }

    // Attempt insertion; unique compound index prevents duplicates
    try {
      const wishlistItem = await Wishlist.create({
        clerkUserId,
        propertyId: new Types.ObjectId(propertyId),
      });

      res.status(201).json({
        success: true,
        message: "Property added to wishlist",
        data: {
          _id: wishlistItem._id,
          propertyId: wishlistItem.propertyId,
          createdAt: wishlistItem.createdAt,
        },
      });
    } catch (createError: unknown) {
      // Handle duplicate wishlist entry gracefully (E11000)
      if (
        typeof createError === "object" &&
        createError !== null &&
        "code" in createError &&
        (createError as { code: number }).code === 11000
      ) {
        res.status(409).json({
          success: false,
          message: "Property is already in your wishlist",
        });
        return;
      }
      throw createError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/me/wishlist/:propertyId
 * Removes a property from the authenticated user's wishlist (FR-USR-004).
 */
export const removeFromWishlist: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = propertyIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid property ID parameter",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const { propertyId } = paramValidation.data;

    // Delete matching entry belonging exclusively to the current user
    const deleted = await Wishlist.findOneAndDelete({
      clerkUserId,
      propertyId: new Types.ObjectId(propertyId),
    });

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Property not found in your wishlist",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Property removed from wishlist",
    });
  } catch (error) {
    next(error);
  }
};

