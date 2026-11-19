import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/;

export const createEnquirySchema = z.object({
  propertyId: z
    .string({ message: "Property ID is required" })
    .trim()
    .regex(objectIdRegex, "Invalid property ID format"),

  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters"),

  email: z
    .string({ message: "Email is required" })
    .trim()
    .email("Invalid email address")
    .toLowerCase(),

  phone: z
    .string({ message: "Phone number is required" })
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .regex(phoneRegex, "Invalid phone number format"),

  message: z
    .string({ message: "Message is required" })
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must not exceed 2000 characters"),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
