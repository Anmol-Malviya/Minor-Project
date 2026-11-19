import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/database";
import { Property, Partner, SiteSettings } from "../models";
import {
  verifyCloudinaryAsset,
  validatePropertyImagesIntegrity,
} from "../services/image.service";

// Guard: strictly forbid running seed script in production environments
if (process.env.NODE_ENV === "production") {
  console.error("ERROR: Development seed script cannot run in production mode.");
  process.exit(1);
}

// Development fixture property definitions
// Note: Intended as Published only if genuine, verified Cloudinary assets exist.
// If valid Cloudinary assets are unavailable, they are automatically downgraded to Draft with empty images.
const candidateProperties = [
  {
    title: "Riverfront Two Bedroom Luxury Apartment",
    slug: "riverfront-two-bedroom-luxury-apartment",
    description:
      "A bright and elegant two bedroom apartment overlooking the scenic Brahmaputra riverfront, featuring a private balcony and premium fittings.",
    priceAmount: 7_500_000,
    currency: "INR",
    propertyType: "Apartment",
    location: {
      locality: "Uzan Bazar",
      city: "Guwahati",
      state: "Assam",
      pincode: "781001",
      streetAddress: "Riverside Road, Block B",
    },
    specifications: {
      area: 1250,
      areaUnit: "sq ft",
      bedrooms: 2,
      bathrooms: 2,
      floor: 4,
    },
    amenities: ["Lift", "Covered parking", "Balcony", "Security", "Power Backup"],
    imagesCandidate: [
      {
        secureUrl: process.env.SEED_PROPERTY_IMAGE_URL || "",
        cloudinaryPublicId: process.env.SEED_PROPERTY_IMAGE_PUBLIC_ID || "",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
    isBestValue: true,
    isTrending: false,
    createdBy: "dev-seed-script",
  },
  {
    title: "Hillside Four Bedroom Family Villa",
    slug: "hillside-four-bedroom-family-villa",
    description:
      "A sprawling hilltop residence surrounded by pine woods, featuring landscaped gardens, modular kitchen, and panoramic valley views.",
    priceAmount: 18_500_000,
    currency: "INR",
    propertyType: "Villa",
    location: {
      locality: "Laitumkhrah",
      city: "Shillong",
      state: "Meghalaya",
      pincode: "793003",
      streetAddress: "Pine Hill Estate",
    },
    specifications: {
      area: 3200,
      areaUnit: "sq ft",
      bedrooms: 4,
      bathrooms: 4,
      floor: 2,
    },
    amenities: ["Garden", "Covered parking", "Fireplace", "Terrace", "Water Storage"],
    imagesCandidate: [],
    isBestValue: false,
    isTrending: true,
    createdBy: "dev-seed-script",
  },
  {
    title: "Central Commercial Office Space",
    slug: "central-commercial-office-space",
    description:
      "Modern Grade-A commercial workspace situated along GS Road, fully ready for corporate fit-out with high-speed elevators.",
    priceAmount: 14_000_000,
    currency: "INR",
    propertyType: "Commercial",
    location: {
      locality: "GS Road",
      city: "Guwahati",
      state: "Assam",
      pincode: "781005",
      streetAddress: "Commercial Tower 5th Floor",
    },
    specifications: {
      area: 2100,
      areaUnit: "sq ft",
      bathrooms: 2,
      floor: 5,
    },
    amenities: ["Lift", "Security", "Power Backup", "Visitor Parking", "Fire Safety"],
    imagesCandidate: [],
    isBestValue: false,
    isTrending: true,
    createdBy: "dev-seed-script",
  },
  {
    title: "Residential Land Plot in Dibrugarh",
    slug: "residential-land-plot-in-dibrugarh",
    description:
      "Prime freehold residential plot in a rapidly appreciating residential neighborhood, perfect for constructing a bespoke bungalow.",
    priceAmount: 3_800_000,
    currency: "INR",
    propertyType: "Plot",
    location: {
      locality: "Chiring Chapori",
      city: "Dibrugarh",
      state: "Assam",
      pincode: "786001",
      streetAddress: "Plot 42, Sector 3",
    },
    specifications: {
      area: 4000,
      areaUnit: "sq ft",
      plotArea: 4000,
    },
    amenities: ["Wide Road Access", "Electricity Connection", "Boundary Wall"],
    imagesCandidate: [],
    isBestValue: true,
    isTrending: false,
    createdBy: "dev-seed-script",
  },
  {
    title: "Upcoming Eco Living Sanctuary (Draft)",
    slug: "upcoming-eco-living-sanctuary-draft",
    description:
      "A preliminary draft listing for an eco-conscious luxury gated community planned in Upper Shillong.",
    priceAmount: 22_000_000,
    currency: "INR",
    propertyType: "Villa",
    location: {
      locality: "Upper Shillong",
      city: "Shillong",
      state: "Meghalaya",
      pincode: "793005",
    },
    specifications: {
      area: 4200,
      areaUnit: "sq ft",
      bedrooms: 5,
      bathrooms: 5,
    },
    amenities: ["Solar Power", "Rainwater Harvesting", "Clubhouse"],
    imagesCandidate: [],
    isBestValue: false,
    isTrending: false,
    createdBy: "dev-seed-script",
  },
  {
    title: "Heritage Colonial Bungalow (Sold)",
    slug: "heritage-colonial-bungalow-sold",
    description:
      "A restored heritage tea planter's bungalow with extensive manicured grounds, previously sold.",
    priceAmount: 35_000_000,
    currency: "INR",
    propertyType: "Villa",
    location: {
      locality: "Jorhat Town",
      city: "Jorhat",
      state: "Assam",
      pincode: "785001",
    },
    specifications: {
      area: 5500,
      areaUnit: "sq ft",
      bedrooms: 5,
      bathrooms: 4,
    },
    amenities: ["Garden", "Staff Quarters", "Tennis Court"],
    imagesCandidate: [],
    isBestValue: false,
    isTrending: false,
    createdBy: "dev-seed-script",
  },
];

// Sample partner records showcasing financial and design collaborations
const candidatePartners = [
  {
    name: "HDFC Home Loans",
    logoAssetCandidate: {
      secureUrl: process.env.SEED_PARTNER_HDFC_LOGO_URL || "",
      cloudinaryPublicId: process.env.SEED_PARTNER_HDFC_PUBLIC_ID || "",
    },
    websiteUrl: "https://www.hdfcbank.com",
    sortOrder: 1,
    isActive: true,
  },
  {
    name: "State Bank of India Home Finance",
    logoAssetCandidate: {
      secureUrl: process.env.SEED_PARTNER_SBI_LOGO_URL || "",
      cloudinaryPublicId: process.env.SEED_PARTNER_SBI_PUBLIC_ID || "",
    },
    websiteUrl: "https://homeloans.sbi",
    sortOrder: 2,
    isActive: true,
  },
  {
    name: "Apex Architecture Studio",
    logoAssetCandidate: {
      secureUrl: process.env.SEED_PARTNER_APEX_LOGO_URL || "",
      cloudinaryPublicId: process.env.SEED_PARTNER_APEX_PUBLIC_ID || "",
    },
    websiteUrl: "https://www.apexarchitecture.example.com",
    sortOrder: 3,
    isActive: true,
  },
  {
    name: "Legacy Realty Advisory (Inactive)",
    logoAssetCandidate: undefined,
    websiteUrl: "https://www.legacyrealty.example.com",
    sortOrder: 4,
    isActive: false, // Testing that public API filters inactive records
  },
];

export async function runSeed(): Promise<void> {
  console.log("--- Starting REALITY DREAMS Development Database Seed ---");

  await connectDB();

  try {
    // 1. Seed Properties with strict Media-Integrity verification
    let propertiesInserted = 0;
    let propertiesSkipped = 0;

    for (const propCandidate of candidateProperties) {
      const existing = await Property.findOne({ slug: propCandidate.slug });
      if (!existing) {
        // Strict Media Integrity Rule:
        // A property is ONLY marked 'Published' if genuine, verified Cloudinary assets are provided.
        // If unverified or unavailable, property MUST be seeded as 'Draft' with empty images.
        let verifiedImages: Array<{
          secureUrl: string;
          cloudinaryPublicId: string;
          isPrimary: boolean;
          sortOrder: number;
        }> = [];

        let status: "Published" | "Draft" | "Sold" = "Draft";

        if (
          propCandidate.imagesCandidate &&
          propCandidate.imagesCandidate.length > 0 &&
          propCandidate.imagesCandidate.every(
            (img) => img.secureUrl && img.cloudinaryPublicId
          )
        ) {
          try {
            for (const img of propCandidate.imagesCandidate) {
              await verifyCloudinaryAsset(img);
            }
            validatePropertyImagesIntegrity(
              propCandidate.imagesCandidate,
              "Published"
            );
            verifiedImages = propCandidate.imagesCandidate;
            status = "Published";
          } catch (verificationErr) {
            console.warn(
              `[Property] Cloudinary verification not met for '${propCandidate.title}'. Seeding as Draft with empty images to enforce media-integrity rules.`
            );
            verifiedImages = [];
            status = "Draft";
          }
        } else {
          // If title marks Sold and has no images, preserve Sold or Draft
          if (propCandidate.title.includes("(Sold)")) {
            status = "Sold";
          } else {
            status = "Draft";
          }
        }

        await Property.create({
          title: propCandidate.title,
          slug: propCandidate.slug,
          description: propCandidate.description,
          priceAmount: propCandidate.priceAmount,
          currency: propCandidate.currency,
          propertyType: propCandidate.propertyType,
          status,
          location: propCandidate.location,
          specifications: propCandidate.specifications,
          amenities: propCandidate.amenities,
          images: verifiedImages,
          isBestValue: propCandidate.isBestValue,
          isTrending: propCandidate.isTrending,
          createdBy: propCandidate.createdBy,
        });

        console.log(
          `[Property] Inserted: '${propCandidate.title}' (Status: ${status}, Images: ${verifiedImages.length})`
        );
        propertiesInserted++;
      } else {
        console.log(`[Property] Skipped (already exists): '${propCandidate.slug}'`);
        propertiesSkipped++;
      }
    }

    // 2. Seed Partners with strict Logo asset verification
    let partnersInserted = 0;
    let partnersSkipped = 0;

    for (const partnerCandidate of candidatePartners) {
      const existing = await Partner.findOne({ name: partnerCandidate.name });
      if (!existing) {
        let verifiedLogo:
          | { secureUrl: string; cloudinaryPublicId: string }
          | undefined = undefined;

        if (
          partnerCandidate.logoAssetCandidate?.secureUrl &&
          partnerCandidate.logoAssetCandidate?.cloudinaryPublicId
        ) {
          try {
            await verifyCloudinaryAsset(partnerCandidate.logoAssetCandidate);
            verifiedLogo = partnerCandidate.logoAssetCandidate;
          } catch (err) {
            console.warn(
              `[Partner] Cloudinary logo verification not met for '${partnerCandidate.name}'. Seeding without logoAsset per schema.`
            );
            verifiedLogo = undefined;
          }
        }

        await Partner.create({
          name: partnerCandidate.name,
          logoAsset: verifiedLogo,
          websiteUrl: partnerCandidate.websiteUrl,
          sortOrder: partnerCandidate.sortOrder,
          isActive: partnerCandidate.isActive,
        });

        console.log(
          `[Partner] Inserted: '${partnerCandidate.name}' (Active: ${
            partnerCandidate.isActive
          }, Logo: ${verifiedLogo ? "Verified" : "None"})`
        );
        partnersInserted++;
      } else {
        console.log(
          `[Partner] Skipped (already exists): '${partnerCandidate.name}'`
        );
        partnersSkipped++;
      }
    }

    // 3. Ensure Default SiteSettings document exists
    const existingSettings = await SiteSettings.findOne();
    if (!existingSettings) {
      const newSettings = new SiteSettings({
        businessContact: {
          phone: "+91 98765 43210",
          email: "contact@realitydreams.com",
          address: "102 Luxury Enclave, GS Road, Guwahati, Assam 781005",
          workingHours: "Monday - Saturday: 9:00 AM - 6:00 PM",
        },
        socialLinks: [
          { platform: "Instagram", url: "https://instagram.com/realitydreams" },
          { platform: "LinkedIn", url: "https://linkedin.com/company/realitydreams" },
        ],
        hero: {
          headline: "Discover Your Dream Sanctuary Across North East India",
          description:
            "Curated collection of premier villas, luxury apartments, and strategic commercial properties.",
          ctaText: "Explore Properties",
        },
        about: {
          title: "Crafting Unmatched Real Estate Experiences",
          content:
            "REALITY DREAMS is North East India's leading boutique luxury real estate advisory, connecting discerning clients with landmark homes and strategic investments.",
        },
        sectionVisibility: {
          showBestValue: true,
          showTrending: true,
          showAbout: true,
          showPartners: true,
        },
        sectionOrder: ["bestValue", "trending", "about", "partners"],
        updatedBy: "dev-seed-script",
      });

      await newSettings.save();
      console.log("[SiteSettings] Initialized default website settings.");
    } else {
      console.log("[SiteSettings] Skipped (already initialized).");
    }

    console.log("\n--- Seed Execution Summary ---");
    console.log(
      `Properties: ${propertiesInserted} inserted, ${propertiesSkipped} skipped.`
    );
    console.log(
      `Partners:   ${partnersInserted} inserted, ${partnersSkipped} skipped.`
    );
    console.log("-------------------------------------------------------------");
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

// Execute when invoked directly from CLI
if (require.main === module) {
  runSeed().catch((error) => {
    console.error("Seed script encountered a fatal error:", error);
    process.exit(1);
  });
}
