import { RequestHandler } from "express";
import { Property, Enquiry } from "../models";

/**
 * GET /api/v1/admin/overview
 * Real-time operational dashboard metrics and recent business activity (FR-ADM-003, FR-ADM-005).
 */
export const getAdminOverview: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Run aggregations and recent activity queries in parallel for peak efficiency
    const [
      propertyStatusAgg,
      enquiryStatusAgg,
      recentEnquiries,
      recentProperties,
    ] = await Promise.all([
      // Group properties by status
      Property.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Group enquiries by status
      Enquiry.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // 5 most recent enquiries with property context
      Enquiry.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({
          path: "propertyId",
          select: "title slug propertyType status location.city images.secureUrl",
        })
        .lean(),

      // 5 most recently updated properties
      Property.find()
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title slug status priceAmount currency updatedAt isBestValue isTrending")
        .lean(),
    ]);

    // Build structured property stats
    const propertyCounts: Record<string, number> = {
      Draft: 0,
      Published: 0,
      Sold: 0,
      Archived: 0,
    };
    let totalProperties = 0;
    for (const item of propertyStatusAgg) {
      if (item._id && typeof item.count === "number") {
        propertyCounts[item._id] = item.count;
        totalProperties += item.count;
      }
    }

    // Build structured enquiry stats
    const enquiryCounts: Record<string, number> = {
      New: 0,
      Contacted: 0,
      "Visit Scheduled": 0,
      Closed: 0,
      Spam: 0,
    };
    let totalEnquiries = 0;
    for (const item of enquiryStatusAgg) {
      if (item._id && typeof item.count === "number") {
        enquiryCounts[item._id] = item.count;
        totalEnquiries += item.count;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        properties: {
          total: totalProperties,
          byStatus: propertyCounts,
        },
        enquiries: {
          total: totalEnquiries,
          byStatus: enquiryCounts,
          newEnquiriesCount: enquiryCounts["New"] || 0,
        },
        recentEnquiries,
        recentProperties,
      },
    });
  } catch (error) {
    next(error);
  }
};

