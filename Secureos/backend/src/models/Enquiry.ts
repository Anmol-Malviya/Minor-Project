import mongoose, { Schema, Document, Types } from "mongoose";

// Defined strictly per SRS Section 6.4 (FR-ADM-020)
export type EnquiryStatus =
  | "New"
  | "Contacted"
  | "Visit Scheduled"
  | "Closed"
  | "Spam";

export const ENQUIRY_STATUSES: EnquiryStatus[] = [
  "New",
  "Contacted",
  "Visit Scheduled",
  "Closed",
  "Spam",
];

export interface IEnquiry extends Document {
  propertyId: Types.ObjectId;
  clerkUserId?: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: EnquiryStatus;
  internalNotes?: string;
  lastUpdatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    clerkUserId: {
      type: String,
      trim: true,
      index: true,
      sparse: true, // Only indexed when user is authenticated (guest submissions are null/undefined)
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ENQUIRY_STATUSES,
      default: "New",
      required: true,
      index: true,
    },
    internalNotes: {
      type: String,
      default: "",
    },
    lastUpdatedBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Targeted indexes:
// 1. Admin enquiry inbox: filter by status, sort newest first
enquirySchema.index({ status: 1, createdAt: -1 });

// 2. User account: "My Enquiries" query
enquirySchema.index({ clerkUserId: 1, createdAt: -1 });

// 3. Admin property enquiry history
enquirySchema.index({ propertyId: 1, createdAt: -1 });

const Enquiry = mongoose.model<IEnquiry>("Enquiry", enquirySchema);

export default Enquiry;

