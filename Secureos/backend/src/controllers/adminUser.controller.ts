import { RequestHandler } from "express";
import { QueryFilter } from "mongoose";
import { UserProfile, IUserProfile } from "../models";
import { adminUserQuerySchema } from "../validators/admin.validator";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/v1/admin/users
 * Retrieve registered user profiles with keyword search (name, email, phone) and pagination (FR-ADM-022).
 * Admin-only: strictly projects non-sensitive profile fields.
 */
export const getAdminUsers: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const queryValidation = adminUserQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: queryValidation.error.issues,
      });
      return;
    }

    const { keyword } = queryValidation.data;
    const page = queryValidation.data.page ?? 1;
    const limit = queryValidation.data.limit ?? 10;
    const skip = (page - 1) * limit;

    const filters: QueryFilter<IUserProfile>[] = [];

    if (keyword) {
      const safeKeyword = new RegExp(escapeRegExp(keyword), "i");
      filters.push({
        $or: [
          { name: safeKeyword },
          { email: safeKeyword },
          { phone: safeKeyword },
        ],
      });
    }

    const filter: QueryFilter<IUserProfile> =
      filters.length === 0
        ? {}
        : filters.length === 1
        ? filters[0]
        : { $and: filters };

    const [total, users] = await Promise.all([
      UserProfile.countDocuments(filter),
      UserProfile.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("name email phone avatarUrl role clerkUserId createdAt updatedAt")
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

