import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const propertyObjectIdParamSchema = z.object({
  id: z
    .string({ message: "Property ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid property ID format"),
});

const queryText = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().optional()
);

const queryBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return value;
  }
  return value;
}, z.boolean({ message: "Must be a boolean (true or false)" }).optional());

const queryNumber = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)
      ? Number(trimmed)
      : Number.NaN;
  },
  z.number().finite()
);

const nonNegativeQueryNumber = queryNumber.refine(
  (value) => value >= 0,
  "Must be a non-negative number"
);

const positiveIntegerQueryNumber = queryNumber
  .refine(Number.isInteger, "Must be an integer")
  .refine((value) => value > 0, "Must be greater than zero")
  .refine(Number.isSafeInteger, "Must be a safe integer");

const nonNegativeIntegerQueryNumber = queryNumber
  .refine(Number.isInteger, "Must be an integer")
  .refine((value) => value >= 0, "Must be non-negative")
  .refine(Number.isSafeInteger, "Must be a safe integer");

export const propertyImageSchema = z.object({
  secureUrl: z.string().trim().url("Must be a valid secure URL"),
  cloudinaryPublicId: z.string().trim().min(1, "Cloudinary public ID is required"),
  altText: z.string().trim().default(""),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export type PropertyImageInput = z.infer<typeof propertyImageSchema>;

export const createPropertySchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    slug: z.string().trim().min(3).max(180),
    description: z.string().min(10),
    priceAmount: z.number().nonnegative(),
    currency: z.string().default("INR"),
    propertyType: z.string().min(2),
    status: z.enum(["Draft", "Published", "Sold", "Archived"]).default("Draft"),

    location: z.object({
      locality: z.string().optional(),
      city: z.string().min(2),
      state: z.string().min(2),
      pincode: z.string().optional(),
      streetAddress: z.string().optional(),
    }),

    specifications: z
      .object({
        area: z.number().positive().optional(),
        areaUnit: z.string().optional(),
        bedrooms: z.number().int().nonnegative().optional(),
        bathrooms: z.number().int().nonnegative().optional(),
        floor: z.number().int().optional(),
        plotArea: z.number().positive().optional(),
      })
      .optional(),

    amenities: z.array(z.string()).default([]),
    images: z.array(propertyImageSchema).default([]),
    isBestValue: z.boolean().default(false),
    isTrending: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    // Check for duplicate images
    const seenPublicIds = new Set<string>();
    const seenUrls = new Set<string>();
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      if (seenPublicIds.has(img.cloudinaryPublicId)) {
        ctx.addIssue({
          code: "custom",
          path: ["images", i, "cloudinaryPublicId"],
          message: `Duplicate image public ID '${img.cloudinaryPublicId}' is not allowed`,
        });
      }
      seenPublicIds.add(img.cloudinaryPublicId);

      if (seenUrls.has(img.secureUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["images", i, "secureUrl"],
          message: `Duplicate image URL '${img.secureUrl}' is not allowed`,
        });
      }
      seenUrls.add(img.secureUrl);
    }

    // Ensure no more than one primary image is selected
    const primaryCount = data.images.filter((img) => img.isPrimary).length;
    if (primaryCount > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: "A property cannot have more than one primary image",
      });
    }

    // Published listings require at least one image with a designated primary image (FR-ADM-013)
    if (data.status === "Published") {
      if (data.images.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["images"],
          message: "Published properties must have at least one image",
        });
      } else if (primaryCount === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["images"],
          message: "Published properties must have a primary image designated",
        });
      }
    }
  });

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = z
  .object({
    title: z.string().trim().min(3).max(150).optional(),
    slug: z.string().trim().min(3).max(180).optional(),
    description: z.string().min(10).optional(),
    priceAmount: z.number().nonnegative().optional(),
    currency: z.string().optional(),
    propertyType: z.string().min(2).optional(),
    status: z.enum(["Draft", "Published", "Sold", "Archived"]).optional(),

    location: z
      .object({
        locality: z.string().optional(),
        city: z.string().min(2).optional(),
        state: z.string().min(2).optional(),
        pincode: z.string().optional(),
        streetAddress: z.string().optional(),
      })
      .optional(),

    specifications: z
      .object({
        area: z.number().positive().optional(),
        areaUnit: z.string().optional(),
        bedrooms: z.number().int().nonnegative().optional(),
        bathrooms: z.number().int().nonnegative().optional(),
        floor: z.number().int().optional(),
        plotArea: z.number().positive().optional(),
      })
      .optional(),

    amenities: z.array(z.string()).optional(),
    images: z.array(propertyImageSchema).optional(),
    isBestValue: z.boolean().optional(),
    isTrending: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.images) {
      const seenPublicIds = new Set<string>();
      const seenUrls = new Set<string>();
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        if (seenPublicIds.has(img.cloudinaryPublicId)) {
          ctx.addIssue({
            code: "custom",
            path: ["images", i, "cloudinaryPublicId"],
            message: `Duplicate image public ID '${img.cloudinaryPublicId}' is not allowed`,
          });
        }
        seenPublicIds.add(img.cloudinaryPublicId);

        if (seenUrls.has(img.secureUrl)) {
          ctx.addIssue({
            code: "custom",
            path: ["images", i, "secureUrl"],
            message: `Duplicate image URL '${img.secureUrl}' is not allowed`,
          });
        }
        seenUrls.add(img.secureUrl);
      }

      const primaryCount = data.images.filter((img) => img.isPrimary).length;
      if (primaryCount > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["images"],
          message: "A property cannot have more than one primary image",
        });
      }

      if (data.status === "Published") {
        if (data.images.length === 0) {
          ctx.addIssue({
            code: "custom",
            path: ["images"],
            message: "Published properties must have at least one image",
          });
        } else if (primaryCount !== 1) {
          ctx.addIssue({
            code: "custom",
            path: ["images"],
            message: "Published properties must have exactly one primary image designated",
          });
        }
      }
    }
  });

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

export const adminPropertyQuerySchema = z.object({
  status: z.enum(["Draft", "Published", "Sold", "Archived"]).optional(),
  propertyType: queryText,
  keyword: queryText,
  page: positiveIntegerQueryNumber.optional(),
  limit: positiveIntegerQueryNumber.optional(),
});

export type AdminPropertyQuery = z.infer<typeof adminPropertyQuerySchema>;

export const propertySearchQuerySchema = z
  .object({
    keyword: queryText,
    location: queryText,
    propertyType: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z.string().min(1, "Property type cannot be empty").optional()
    ),
    minPrice: nonNegativeQueryNumber.optional(),
    maxPrice: nonNegativeQueryNumber.optional(),
    bedrooms: nonNegativeIntegerQueryNumber.optional(),
    bathrooms: nonNegativeIntegerQueryNumber.optional(),
    minArea: nonNegativeQueryNumber.optional(),
    maxArea: nonNegativeQueryNumber.optional(),
    sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
    isBestValue: queryBoolean,
    isTrending: queryBoolean,
    page: positiveIntegerQueryNumber.optional(),
    limit: positiveIntegerQueryNumber.optional(),
  })
  .superRefine((query, context) => {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      context.addIssue({
        code: "custom",
        path: ["minPrice"],
        message: "minPrice must not exceed maxPrice",
      });
    }

    if (
      query.minArea !== undefined &&
      query.maxArea !== undefined &&
      query.minArea > query.maxArea
    ) {
      context.addIssue({
        code: "custom",
        path: ["minArea"],
        message: "minArea must not exceed maxArea",
      });
    }

    if (query.limit !== undefined && query.limit > 50) {
      context.addIssue({
        code: "custom",
        path: ["limit"],
        message: "limit must not exceed 50",
      });
    }
  });

export type PropertySearchQuery = z.infer<typeof propertySearchQuerySchema>;
