import mongoose, { Schema, Document } from "mongoose";

export interface IPartnerLogo {
  secureUrl: string;
  cloudinaryPublicId: string;
}

export interface IPartner extends Document {
  name: string;
  logoAsset?: IPartnerLogo;
  websiteUrl?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const partnerLogoSchema = new Schema<IPartnerLogo>(
  {
    secureUrl: {
      type: String,
      required: true,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const partnerSchema = new Schema<IPartner>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logoAsset: {
      type: partnerLogoSchema,
      required: false,
    },
    websiteUrl: {
      type: String,
      trim: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Targeted index for homepage active partner carousel/grid
partnerSchema.index({ isActive: 1, sortOrder: 1 });

const Partner = mongoose.model<IPartner>("Partner", partnerSchema);

export default Partner;

