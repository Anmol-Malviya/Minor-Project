import mongoose, { Schema, Document } from "mongoose";

export type AuditEntityType =
  | "Property"
  | "Enquiry"
  | "SiteSettings"
  | "Partner"
  | "UserProfile";

export interface IAuditLog extends Document {
  actorClerkUserId: string;
  action: string;
  entityType: AuditEntityType;
  entityId?: string;
  changeSummary?: Record<string, unknown> | string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorClerkUserId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ["Property", "Enquiry", "SiteSettings", "Partner", "UserProfile"],
      index: true,
    },
    entityId: {
      type: String,
      trim: true,
    },
    changeSummary: {
      type: Schema.Types.Mixed,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Targeted indexes:
// 1. Audit chronology
auditLogSchema.index({ createdAt: -1 });

// 2. Audit logs by admin actor
auditLogSchema.index({ actorClerkUserId: 1, createdAt: -1 });

// 3. Audit trail for a specific entity
auditLogSchema.index({ entityType: 1, entityId: 1 });

const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;

