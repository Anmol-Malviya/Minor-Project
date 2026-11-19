import mongoose, { Schema, Document } from "mongoose";

export type HomepageSection = "bestValue" | "trending" | "about" | "partners";

export const HOMEPAGE_SECTIONS: HomepageSection[] = [
  "bestValue",
  "trending",
  "about",
  "partners",
];

export interface ISiteLogo {
  secureUrl: string;
  cloudinaryPublicId: string;
}

export interface ISocialLink {
  platform: string;
  url: string;
}

export interface IBusinessContact {
  phone: string;
  email: string;
  address: string;
  workingHours?: string;
}

export interface IHeroContent {
  headline: string;
  description: string;
  ctaText: string;
}

export interface IAboutContent {
  title: string;
  content: string;
}

export interface ISectionVisibility {
  showBestValue: boolean;
  showTrending: boolean;
  showAbout: boolean;
  showPartners: boolean;
}

export interface ISiteSettings extends Document {
  businessContact: IBusinessContact;
  socialLinks: ISocialLink[];
  hero: IHeroContent;
  about: IAboutContent;
  logoAsset?: ISiteLogo;
  sectionVisibility: ISectionVisibility;
  sectionOrder: HomepageSection[];
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    businessContact: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      workingHours: { type: String, default: "" },
    },
    socialLinks: [
      {
        _id: false,
        platform: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    hero: {
      headline: {
        type: String,
        default: "Find Your Dream Property with REALITY DREAMS",
      },
      description: {
        type: String,
        default:
          "Discover premium residential and commercial properties curated for quality and value.",
      },
      ctaText: { type: String, default: "Explore Properties" },
    },
    about: {
      title: { type: String, default: "About REALITY DREAMS" },
      content: {
        type: String,
        default:
          "Your trusted real estate partner in discovering properties with complete confidence and clarity.",
      },
    },
    logoAsset: {
      _id: false,
      secureUrl: { type: String, default: "" },
      cloudinaryPublicId: { type: String, default: "" },
    },
    sectionVisibility: {
      showBestValue: { type: Boolean, default: true },
      showTrending: { type: Boolean, default: true },
      showAbout: { type: Boolean, default: true },
      showPartners: { type: Boolean, default: true },
    },
    sectionOrder: {
      type: [
        {
          type: String,
          enum: HOMEPAGE_SECTIONS,
        },
      ],
      default: ["bestValue", "trending", "about", "partners"],
      validate: [
        {
          validator: (sections: string[]) => {
            if (!Array.isArray(sections)) return false;
            // Check for duplicates
            const unique = new Set(sections);
            if (unique.size !== sections.length) return false;
            // Check that all identifiers are supported
            return sections.every((s) =>
              HOMEPAGE_SECTIONS.includes(s as HomepageSection)
            );
          },
          message:
            "sectionOrder must contain only unique and supported homepage section identifiers (bestValue, trending, about, partners)",
        },
      ],
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const SiteSettings = mongoose.model<ISiteSettings>(
  "SiteSettings",
  siteSettingsSchema
);

export default SiteSettings;
