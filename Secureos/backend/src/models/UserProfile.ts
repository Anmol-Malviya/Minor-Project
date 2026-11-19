import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "USER" | "ADMIN";

export interface IUserProfile extends Document {
  clerkUserId: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<IUserProfile>(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
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
      trim: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER", // Public registration always defaults to USER
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userProfileSchema.index({ email: 1 });
userProfileSchema.index({ role: 1 });

const UserProfile = mongoose.model<IUserProfile>(
  "UserProfile",
  userProfileSchema
);

export default UserProfile;

