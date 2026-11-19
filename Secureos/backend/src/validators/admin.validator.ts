import { z } from "zod";
import { ENQUIRY_STATUSES, EnquiryStatus } from "../models/Enquiry";
import { HOMEPAGE_SECTIONS, HomepageSection } from "../models/SiteSettings";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdParamSchema = z.object({
  id: z
    .string({ message: "ID parameter is required" })
    .trim()
    .regex(objectIdRegex, "Invalid ID format"),
});

const queryText = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().optional()
);

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

const positiveIntegerQueryNumber = queryNumber
  .refine(Number.isInteger, "Must be an integer")
  .refine((value) => value > 0, "Must be greater than zero")
  .refine(Number.isSafeInteger, "Must be a safe integer");

// Admin Enquiry Queries & Updates
export const adminEnquiryQuerySchema = z.object({
  status: z
    .enum(ENQUIRY_STATUSES as [EnquiryStatus, ...EnquiryStatus[]])
    .optional(),
  keyword: queryText,
  page: positiveIntegerQueryNumber.optional(),
  limit: positiveIntegerQueryNumber.optional(),
});

export type AdminEnquiryQuery = z.infer<typeof adminEnquiryQuerySchema>;

// Disallow client changes to name, email, phone, propertyId, clerkUserId
export const updateEnquirySchema = z
  .object({
    status: z
      .enum(ENQUIRY_STATUSES as [EnquiryStatus, ...EnquiryStatus[]])
      .optional(),
    internalNotes: z.string().optional(),
  })
  .strict();

export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;

// Admin User Queries
export const adminUserQuerySchema = z.object({
  keyword: queryText,
  page: positiveIntegerQueryNumber.optional(),
  limit: positiveIntegerQueryNumber.optional(),
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;

// Admin Site Settings Updates
export const updateSiteSettingsSchema = z
  .object({
    businessContact: z
      .object({
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        workingHours: z.string().optional(),
      })
      .strict()
      .optional(),

    socialLinks: z
      .array(
        z
          .object({
            platform: z.string().min(1, "Platform name is required"),
            url: z.string().url("Valid URL is required"),
          })
          .strict()
      )
      .optional(),

    hero: z
      .object({
        headline: z.string().min(3).optional(),
        description: z.string().min(5).optional(),
        ctaText: z.string().min(2).optional(),
      })
      .strict()
      .optional(),

    about: z
      .object({
        title: z.string().min(3).optional(),
        content: z.string().min(10).optional(),
      })
      .strict()
      .optional(),

    logoAsset: z
      .object({
        secureUrl: z.string().url("Valid secure URL is required"),
        cloudinaryPublicId: z
          .string()
          .min(1, "Cloudinary public ID is required"),
      })
      .strict()
      .optional(),

    sectionVisibility: z
      .object({
        showBestValue: z.boolean().optional(),
        showTrending: z.boolean().optional(),
        showAbout: z.boolean().optional(),
        showPartners: z.boolean().optional(),
      })
      .strict()
      .optional(),

    sectionOrder: z
      .array(
        z.enum(HOMEPAGE_SECTIONS as [HomepageSection, ...HomepageSection[]])
      )
      .optional()
      .superRefine((sections, ctx) => {
        if (sections) {
          const unique = new Set(sections);
          if (unique.size !== sections.length) {
            ctx.addIssue({
              code: "custom",
              message:
                "sectionOrder must not contain duplicate section identifiers",
            });
          }
        }
      }),
  })
  .strict();

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;

// Admin Partner Management Schemas
export const createPartnerSchema = z
  .object({
    name: z
      .string({ message: "Partner name is required" })
      .trim()
      .min(1, "Partner name cannot be empty"),
    logoAsset: z
      .object({
        secureUrl: z.string().url("Valid logo secure URL is required"),
        cloudinaryPublicId: z
          .string()
          .min(1, "Cloudinary public ID is required"),
      })
      .strict()
      .optional(),
    websiteUrl: z
      .string()
      .url("Valid website URL is required")
      .optional()
      .or(z.literal("")),
    sortOrder: z.number().int("sortOrder must be an integer").min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

export const updatePartnerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Partner name cannot be empty")
      .optional(),
    logoAsset: z
      .object({
        secureUrl: z.string().url("Valid logo secure URL is required"),
        cloudinaryPublicId: z
          .string()
          .min(1, "Cloudinary public ID is required"),
      })
      .strict()
      .optional(),
    websiteUrl: z
      .string()
      .url("Valid website URL is required")
      .optional()
      .or(z.literal("")),
    sortOrder: z.number().int("sortOrder must be an integer").min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

