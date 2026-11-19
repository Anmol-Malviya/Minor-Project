import { RequestHandler } from "express";
import { Partner } from "../models";

/**
 * GET /api/v1/partners
 * Retrieve active partners sorted by sortOrder for public homepage showcase (SRS Section 8.4, FR-ADM-023).
 * Strictly projects public-safe fields: never leaks cloudinaryPublicId or internal metadata.
 */
export const getPublicPartners: RequestHandler = async (_req, res, next) => {
  try {
    const partners = await Partner.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    const publicPartners = partners.map((p) => ({
      _id: p._id,
      name: p.name,
      logoUrl: p.logoAsset?.secureUrl || "",
      websiteUrl: p.websiteUrl || "",
      sortOrder: p.sortOrder,
    }));

    res.status(200).json({
      success: true,
      data: publicPartners,
    });
  } catch (error) {
    next(error);
  }
};

