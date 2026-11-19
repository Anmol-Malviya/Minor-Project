import { RequestHandler } from "express";
import { QueryFilter } from "mongoose";
import { Enquiry, IEnquiry, AuditLog } from "../models";
import {
  adminEnquiryQuerySchema,
  objectIdParamSchema,
  updateEnquirySchema,
} from "../validators/admin.validator";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/v1/admin/enquiries
 * Retrieve customer enquiries with filtering by status, keyword search, and pagination (FR-ADM-017, FR-ADM-018, FR-ADM-019).
 * Admin-only: includes internal notes and populated property context.
 */
export const getAdminEnquiries: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const queryValidation = adminEnquiryQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: queryValidation.error.issues,
      });
      return;
    }

    const { status, keyword } = queryValidation.data;
    const page = queryValidation.data.page ?? 1;
    const limit = queryValidation.data.limit ?? 10;
    const skip = (page - 1) * limit;

    const filters: QueryFilter<IEnquiry>[] = [];

    if (status) {
      filters.push({ status });
    }

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

    const filter: QueryFilter<IEnquiry> =
      filters.length === 0
        ? {}
        : filters.length === 1
        ? filters[0]
        : { $and: filters };

    const [total, enquiries] = await Promise.all([
      Enquiry.countDocuments(filter),
      Enquiry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "propertyId",
          select: "title slug propertyType status location.city images.secureUrl",
        })
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: enquiries,
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

/**
 * GET /api/v1/admin/enquiries/:id
 * Retrieve single enquiry detail with full administrative notes and populated property context (FR-ADM-017).
 */
export const getAdminEnquiryById: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = objectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid enquiry ID format",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const enquiry = await Enquiry.findById(paramValidation.data.id)
      .populate({
        path: "propertyId",
        select: "title slug propertyType status location.city images.secureUrl",
      })
      .lean();

    if (!enquiry) {
      res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/enquiries/:id
 * Update enquiry workflow status and administrative internal notes (FR-ADM-020, FR-ADM-021).
 * Strictly restricts updates to status and internalNotes. Immutable fields cannot be modified.
 * Audited in AuditLog collection.
 */
export const updateAdminEnquiry: RequestHandler = async (req, res, next) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const paramValidation = objectIdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid enquiry ID format",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const bodyValidation = updateEnquirySchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid enquiry update data",
        errors: bodyValidation.error.issues,
      });
      return;
    }

    if (
      bodyValidation.data.status === undefined &&
      bodyValidation.data.internalNotes === undefined
    ) {
      res.status(400).json({
        success: false,
        message:
          "At least one field (status or internalNotes) must be provided for update",
      });
      return;
    }

    const enquiry = await Enquiry.findById(paramValidation.data.id);
    if (!enquiry) {
      res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
      return;
    }

    const changeSummary: Record<string, unknown> = {};

    if (
      bodyValidation.data.status !== undefined &&
      bodyValidation.data.status !== enquiry.status
    ) {
      changeSummary.previousStatus = enquiry.status;
      changeSummary.newStatus = bodyValidation.data.status;
      enquiry.status = bodyValidation.data.status;
    }

    if (bodyValidation.data.internalNotes !== undefined) {
      changeSummary.notesUpdated = true;
      enquiry.internalNotes = bodyValidation.data.internalNotes;
    }

    // Always record the verified administrator identity who performed the update
    enquiry.lastUpdatedBy = clerkUserId;
    await enquiry.save();

    // Log administrative action in AuditLog (SRS Section 6.8 & 8.4)
    await AuditLog.create({
      actorClerkUserId: clerkUserId,
      action: "UPDATE_ENQUIRY",
      entityType: "Enquiry",
      entityId: enquiry._id.toString(),
      changeSummary,
    });

    const populatedEnquiry = await Enquiry.findById(enquiry._id)
      .populate({
        path: "propertyId",
        select: "title slug propertyType status location.city images.secureUrl",
      })
      .lean();

    res.status(200).json({
      success: true,
      message: "Enquiry updated successfully",
      data: populatedEnquiry,
    });
  } catch (error) {
    next(error);
  }
};

