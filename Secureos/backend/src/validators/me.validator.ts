import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const propertyIdParamSchema = z.object({
  propertyId: z
    .string({ message: "Property ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid property ID format"),
});

const queryNumber = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)
    ? Number(trimmed)
    : Number.NaN;
}, z.number().finite());

const positiveIntegerQueryNumber = queryNumber
  .refine(Number.isInteger, "Must be an integer")
  .refine((value) => value > 0, "Must be greater than zero")
  .refine(Number.isSafeInteger, "Must be a safe integer");

export const mePaginationQuerySchema = z
  .object({
    page: positiveIntegerQueryNumber.optional(),
    limit: positiveIntegerQueryNumber.optional(),
  })
  .superRefine((query, context) => {
    if (query.limit !== undefined && query.limit > 50) {
      context.addIssue({
        code: "custom",
        path: ["limit"],
        message: "limit must not exceed 50",
      });
    }
  });

export type PropertyIdParam = z.infer<typeof propertyIdParamSchema>;
export type MePaginationQuery = z.infer<typeof mePaginationQuerySchema>;

