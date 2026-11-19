import { RequestHandler } from "express";
import { z } from "zod";
import cloudinary from "../config/cloudinary";
import {
  ALLOWED_IMAGE_FORMATS,
  MAX_IMAGE_FILE_SIZE_BYTES,
  PROPERTY_IMAGES_FOLDER,
} from "../services/image.service";

// Strict schema: reject any client attempts to specify arbitrary folders or parameters
const uploadSignatureRequestSchema = z
  .object({
    folder: z
      .literal(PROPERTY_IMAGES_FOLDER, {
        message: `Uploads are strictly restricted to '${PROPERTY_IMAGES_FOLDER}'`,
      })
      .optional(),
  })
  .strict();

/**
 * POST /api/v1/admin/uploads/signature
 * Generates restricted, time-limited cryptographic Cloudinary upload signature (SRS 8.3, 9.2).
 * Strictly binds uploads to the 'reality-dreams/properties' folder.
 * Never leaks the Cloudinary API secret to browser code.
 */
export const generateUploadSignature: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const clerkUserId = res.locals.auth?.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Validate request body against unauthorized/arbitrary parameters
    const bodyValidation = uploadSignatureRequestSchema.safeParse(req.body || {});
    if (!bodyValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid upload signature request",
        errors: bodyValidation.error.issues,
      });
      return;
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = PROPERTY_IMAGES_FOLDER;

    // Parameters to be signed (Cloudinary signature protocol)
    const paramsToSign: Record<string, string | number> = {
      folder,
      timestamp,
    };

    const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
    const apiKey = process.env.CLOUDINARY_API_KEY || "";
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret
    );

    // Return only public parameters required by client to execute signed upload directly to Cloudinary
    res.status(200).json({
      success: true,
      data: {
        signature,
        timestamp,
        apiKey,
        cloudName,
        folder,
        allowedFormats: ALLOWED_IMAGE_FORMATS,
        maxFileSize: MAX_IMAGE_FILE_SIZE_BYTES,
      },
    });
  } catch (error) {
    next(error);
  }
};
