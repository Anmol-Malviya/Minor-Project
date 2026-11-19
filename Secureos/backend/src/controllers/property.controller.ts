
import { RequestHandler } from "express";
import { QueryFilter } from "mongoose";
import Property, { IProperty } from "../models/Property";
import {
  createPropertySchema,
  propertySearchQuerySchema,
} from "../validators/property.validator";

export const createProperty: RequestHandler = async (req, res) => {
  try {
    // Check verified admin identity from future Clerk middleware
    const auth = res.locals.auth as
      | { clerkUserId?: string; role?: string }
      | undefined;

    if (!auth?.clerkUserId || auth.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    // Validate incoming request data
    const validation = createPropertySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid property data",
        errors: validation.error.issues,
      });
      return;
    }

    // Save property in MongoDB
    const property = await Property.create({
      ...validation.data,
      createdBy: auth.clerkUserId,
    });

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  } catch (error: unknown) {
    // Handle duplicate slug
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "A property with this slug already exists",
      });
      return;
    }

    console.error("Create property error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create property",
    });
  }
};



export const getPublishedProperties: RequestHandler = async (
  req,
  res
) => {
  try {
    const validation = propertySearchQuerySchema.safeParse(req.query);

    if (!validation.success) {
      const message = validation.error.issues
        .map(({ path, message }) => `${path.join(".") || "query"}: ${message}`)
        .join("; ");

      res.status(400).json({
        success: false,
        message: `Invalid query parameters: ${message}`,
      });
      return;
    }

    const {
      keyword,
      location,
      propertyType,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      minArea,
      maxArea,
      isBestValue,
      isTrending,
      sort = "newest",
    } = validation.data;
    const page = validation.data.page ?? 1;
    const limit = validation.data.limit ?? 10;

    const skip = (page - 1) * limit;
    const filters: QueryFilter<IProperty>[] = [{ status: "Published" }];

    if (keyword) {
      const safeKeyword = new RegExp(escapeRegExp(keyword), "i");
      filters.push({ $or: [{ title: safeKeyword }, { description: safeKeyword }] });
    }

    if (location) {
      const safeLocation = new RegExp(escapeRegExp(location), "i");
      filters.push({
        $or: [
          { "location.city": safeLocation },
          { "location.state": safeLocation },
          { "location.locality": safeLocation },
        ],
      });
    }

    if (propertyType) {
      filters.push({ propertyType: new RegExp(`^${escapeRegExp(propertyType)}$`, "i") });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filters.push({
        priceAmount: {
          ...(minPrice !== undefined ? { $gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
        },
      });
    }

    if (bedrooms !== undefined) {
      filters.push({ "specifications.bedrooms": bedrooms });
    }

    if (bathrooms !== undefined) {
      filters.push({ "specifications.bathrooms": bathrooms });
    }

    if (minArea !== undefined || maxArea !== undefined) {
      filters.push({
        "specifications.area": {
          ...(minArea !== undefined ? { $gte: minArea } : {}),
          ...(maxArea !== undefined ? { $lte: maxArea } : {}),
        },
      });
    }

    if (isBestValue !== undefined) {
      filters.push({ isBestValue });
    }

    if (isTrending !== undefined) {
      filters.push({ isTrending });
    }

    const filter: QueryFilter<IProperty> =
      filters.length === 1 ? filters[0] : { $and: filters };
    const sortOption: Record<string, 1 | -1> =
      sort === "price_asc"
        ? { priceAmount: 1 as const, createdAt: -1 as const }
        : sort === "price_desc"
          ? { priceAmount: -1 as const, createdAt: -1 as const }
          : { createdAt: -1 as const };

    // Explicitly project public fields; omit creator IDs and internal image IDs.
    const publicFields =
      "title slug description priceAmount currency propertyType location.locality location.city location.state specifications.area specifications.areaUnit specifications.bedrooms specifications.bathrooms specifications.floor specifications.plotArea amenities images.secureUrl images.altText images.sortOrder images.isPrimary isBestValue isTrending createdAt updatedAt";

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .select(publicFields)
        .sort(sortOption)
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
    console.error("Get properties error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve properties",
    });
  }
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");



export const getPropertyBySlug: RequestHandler = async (
  req,
  res
) => {
  try {
    const publicDetailFields =
      "title slug description priceAmount currency propertyType status location.locality location.city location.state location.pincode specifications.area specifications.areaUnit specifications.bedrooms specifications.bathrooms specifications.floor specifications.plotArea amenities images.secureUrl images.altText images.sortOrder images.isPrimary isBestValue isTrending createdAt updatedAt";

    const property = await Property.findOne({
      slug: req.params.slug,
      status: "Published",
    })
      .select(publicDetailFields)
      .lean();

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
    console.error("Get property error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve property",
    });
  }
};
