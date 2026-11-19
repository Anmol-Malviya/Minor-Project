import { RequestHandler } from "express";
import { Property, Enquiry } from "../models";
import { createEnquirySchema } from "../validators/enquiry.validator";

export const createEnquiry: RequestHandler = async (req, res, next) => {
  try {
    const validation = createEnquirySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid enquiry data",
        errors: validation.error.issues,
      });
      return;
    }

    const { propertyId, name, email, phone, message } = validation.data;

    // Verify referenced property exists and is Published (FR-DET-005, FR-ENQ-001)
    const property = await Property.findOne({
      _id: propertyId,
      status: "Published",
    })
      .select("_id title status")
      .lean();

    if (!property) {
      res.status(404).json({
        success: false,
        message: "Property not found or unavailable for enquiry",
      });
      return;
    }

    // Associate clerkUserId strictly from verified session (if user is authenticated)
    const authenticatedUserId = res.locals.auth?.clerkUserId;

    // Create enquiry with initial status "New"
    const enquiry = await Enquiry.create({
      propertyId,
      clerkUserId: authenticatedUserId || undefined,
      name,
      email,
      phone,
      message,
      status: "New",
      internalNotes: "",
    });

    // Return safe public confirmation without exposing internal notes or admin fields
    res.status(201).json({
      success: true,
      message: "Enquiry submitted successfully",
      data: {
        _id: enquiry._id,
        propertyId: enquiry.propertyId,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

