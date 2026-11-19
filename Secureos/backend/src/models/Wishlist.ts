import mongoose, { Schema, Document, Types } from "mongoose";

export interface IWishlist extends Document {
  clerkUserId: string;
  propertyId: Types.ObjectId;
  createdAt: Date;
}

const wishlistSchema = new Schema<IWishlist>(
  {
    clerkUserId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Prevent duplicate wishlist entries for the same user and property (FR-USR-005, SRS 8.4)
wishlistSchema.index({ clerkUserId: 1, propertyId: 1 }, { unique: true });

// Fast lookup for all saved properties by a user
wishlistSchema.index({ clerkUserId: 1, createdAt: -1 });

const Wishlist = mongoose.model<IWishlist>("Wishlist", wishlistSchema);

export default Wishlist;

