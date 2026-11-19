import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database";
import Property from "../models/Property";

const sampleProperties = [
  {
    title: "Riverfront Two Bedroom Apartment",
    slug: "riverfront-two-bedroom-apartment",
    description:
      "A bright two bedroom apartment near the Brahmaputra riverfront, with a private balcony and convenient access to shopping and transit.",
    priceAmount: 6_500_000,
    currency: "INR",
    propertyType: "Apartment",
    status: "Published" as const,
    location: {
      locality: "Uzan Bazar",
      city: "Guwahati",
      state: "Assam",
      pincode: "781001",
    },
    specifications: {
      area: 1180,
      areaUnit: "sq ft",
      bedrooms: 2,
      bathrooms: 2,
      floor: 5,
    },
    amenities: ["Lift", "Covered parking", "Balcony"],
    isBestValue: true,
    isTrending: false,
    createdBy: "seed-script",
  },
  {
    title: "Hillside Family Villa",
    slug: "hillside-family-villa",
    description:
      "A spacious family villa in a peaceful Shillong neighborhood, with a garden, multiple bedrooms, and views of the surrounding hills.",
    priceAmount: 12_800_000,
    currency: "INR",
    propertyType: "Villa",
    status: "Published" as const,
    location: {
      locality: "Laitumkhrah",
      city: "Shillong",
      state: "Meghalaya",
      pincode: "793003",
    },
    specifications: {
      area: 2400,
      areaUnit: "sq ft",
      bedrooms: 4,
      bathrooms: 3,
      floor: 2,
    },
    amenities: ["Garden", "Covered parking", "Balcony"],
    isBestValue: false,
    isTrending: true,
    createdBy: "seed-script",
  },
  {
    title: "Residential Plot near Dibrugarh Town",
    slug: "residential-plot-near-dibrugarh-town",
    description:
      "A level residential plot in a developing Dibrugarh locality, suitable for planning a family home with access to nearby roads and services.",
    priceAmount: 3_200_000,
    currency: "INR",
    propertyType: "Plot",
    status: "Published" as const,
    location: {
      locality: "Chiring Chapori",
      city: "Dibrugarh",
      state: "Assam",
      pincode: "786001",
    },
    specifications: {
      area: 3600,
      areaUnit: "sq ft",
      plotArea: 3600,
    },
    amenities: ["Road access", "Nearby utilities"],
    isBestValue: true,
    isTrending: false,
    createdBy: "seed-script",
  },
];

async function seedProperties(): Promise<void> {
  await connectDB();

  try {
    const slugs = sampleProperties.map(({ slug }) => slug);
    const existingProperties = await Property.find({ slug: { $in: slugs } })
      .select("slug")
      .lean();
    const existingSlugs = new Set(
      existingProperties.map(({ slug }) => slug)
    );
    const propertiesToInsert = sampleProperties.filter(
      ({ slug }) => !existingSlugs.has(slug)
    );

    if (propertiesToInsert.length === 0) {
      console.log("Seed complete: all sample property slugs already exist.");
      return;
    }

    const insertedProperties = await Property.create(propertiesToInsert);
    console.log(
      `Seed complete: inserted ${insertedProperties.length} properties; skipped ${existingSlugs.size} existing properties.`
    );
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

seedProperties().catch((error: unknown) => {
  console.error("Property seeding failed:", error);
  process.exitCode = 1;
});
