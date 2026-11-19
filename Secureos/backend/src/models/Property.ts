import mongoose, { Schema, Document } from "mongoose";

// Allowed property statuses
export type PropertyStatus =
  | "Draft"
  | "Published"
  | "Sold"
  | "Archived";

// Property image structure
export interface IPropertyImage {
  secureUrl: string;
  cloudinaryPublicId: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
}

// Property document interface
export interface IProperty extends Document {
  title: string;
  slug: string;
  description: string;

  priceAmount: number;
  currency: string;

  propertyType: string;
  status: PropertyStatus;

  location: {
    locality?: string;
    city: string;
    state: string;
    pincode?: string;
    streetAddress?: string;
  };

  specifications: {
    area?: number;
    areaUnit?: string;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    plotArea?: number;
  };

  amenities: string[];
  images: IPropertyImage[];

  isBestValue: boolean;
  isTrending: boolean;

  createdBy: string;
  lastUpdatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Image sub-schema
const propertyImageSchema = new Schema<IPropertyImage>(
  {
    secureUrl: {
      type: String,
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    altText: {
      type: String,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

// Main property schema
const propertySchema = new Schema<IProperty>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      required: true,
    },

    priceAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    propertyType: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Draft", "Published", "Sold", "Archived"],
      default: "Draft",
    },

    location: {
      locality: String,
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      pincode: String,
      streetAddress: String,
    },

    specifications: {
      area: Number,
      areaUnit: String,
      bedrooms: Number,
      bathrooms: Number,
      floor: Number,
      plotArea: Number,
    },

    amenities: {
      type: [String],
      default: [],
    },

    images: {
      type: [propertyImageSchema],
      default: [],
    },

    isBestValue: {
      type: Boolean,
      default: false,
    },

    isTrending: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: String,
      required: true,
    },

    lastUpdatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Targeted compound and single indexes supporting primary query patterns:
// 1. Default public listing sort: newest published properties
propertySchema.index({ status: 1, createdAt: -1 });

// 2. Public listing sorted by price
propertySchema.index({ status: 1, priceAmount: 1, createdAt: -1 });

// 3. Homepage featured sections (Best Value & Trending)
propertySchema.index({ status: 1, isBestValue: 1 });
propertySchema.index({ status: 1, isTrending: 1 });

// 4. Property type and location filters
propertySchema.index({ status: 1, propertyType: 1 });
propertySchema.index({ "location.city": 1 });

const Property = mongoose.model<IProperty>(
  "Property",
  propertySchema
);

export default Property;
