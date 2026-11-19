import { QueryFilter, Types } from "mongoose";
import cloudinary from "../config/cloudinary";
import Property, { IProperty } from "../models/Property";
import Partner from "../models/Partner";
import SiteSettings from "../models/SiteSettings";
import AuditLog from "../models/AuditLog";

export const ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"];
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const PROPERTY_IMAGES_FOLDER = "reality-dreams/properties";

export interface CloudinaryResourceInfo {
  public_id: string;
  format: string;
  resource_type: string;
  bytes: number;
  secure_url: string;
}

/**
 * Verifies a single image asset against Cloudinary server-side metadata.
 * Guards against arbitrary external URLs, mismatched URLs, oversized files, and unsupported formats.
 */
export async function verifyCloudinaryAsset(image: {
  secureUrl: string;
  cloudinaryPublicId: string;
}): Promise<CloudinaryResourceInfo> {
  const { secureUrl, cloudinaryPublicId } = image;

  // 1. Enforce that public ID belongs to the configured properties folder
  if (
    !cloudinaryPublicId ||
    typeof cloudinaryPublicId !== "string" ||
    !cloudinaryPublicId.startsWith(`${PROPERTY_IMAGES_FOLDER}/`)
  ) {
    throw new Error(
      `Invalid Cloudinary public ID '${cloudinaryPublicId}'. Must belong to the '${PROPERTY_IMAGES_FOLDER}' folder.`
    );
  }

  // 2. Reject non-Cloudinary external URLs
  if (!secureUrl.startsWith("https://res.cloudinary.com/")) {
    throw new Error(
      "Invalid image URL. Only secure Cloudinary URLs (https://res.cloudinary.com/...) are permitted."
    );
  }

  // 3. Fetch resource metadata from Cloudinary
  let resource: CloudinaryResourceInfo;
  try {
    resource = (await cloudinary.api.resource(
      cloudinaryPublicId
    )) as CloudinaryResourceInfo;
  } catch (err: unknown) {
    const errorMsg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Asset not found";
    throw new Error(
      `Cloudinary asset verification failed for public ID '${cloudinaryPublicId}': ${errorMsg}`
    );
  }

  if (!resource) {
    throw new Error(
      `Cloudinary asset not found for public ID '${cloudinaryPublicId}'.`
    );
  }

  // 4. Verify resource type is image
  if (resource.resource_type !== "image") {
    throw new Error(
      `Invalid resource type '${resource.resource_type}'. Uploaded asset must be an image.`
    );
  }

  // 5. Verify format is allowed
  const format = resource.format?.toLowerCase();
  if (!format || !ALLOWED_IMAGE_FORMATS.includes(format)) {
    throw new Error(
      `Unsupported image format '${format}'. Allowed formats are: ${ALLOWED_IMAGE_FORMATS.join(
        ", "
      )}.`
    );
  }

  // 6. Verify file size limit
  if (
    typeof resource.bytes === "number" &&
    resource.bytes > MAX_IMAGE_FILE_SIZE_BYTES
  ) {
    throw new Error(
      `Image file size (${resource.bytes} bytes) exceeds maximum limit of 10MB (${MAX_IMAGE_FILE_SIZE_BYTES} bytes).`
    );
  }

  // 7. Verify submitted secure URL matches verified Cloudinary asset
  if (resource.secure_url && secureUrl !== resource.secure_url) {
    throw new Error(
      "Submitted secureUrl does not match the verified Cloudinary asset URL."
    );
  }

  return resource;
}

/**
 * Validates an array of property images for consistency:
 * - Checks for duplicate public IDs or URLs within the listing.
 * - Enforces exactly one primary image when required (for Published status).
 * - Enforces at most one primary image across all statuses.
 */
export function validatePropertyImagesIntegrity(
  images: {
    secureUrl: string;
    cloudinaryPublicId: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }[],
  status?: string
): void {
  const seenPublicIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (const img of images) {
    if (seenPublicIds.has(img.cloudinaryPublicId)) {
      throw new Error(
        `Duplicate image reference detected: public ID '${img.cloudinaryPublicId}' is included more than once.`
      );
    }
    seenPublicIds.add(img.cloudinaryPublicId);

    if (seenUrls.has(img.secureUrl)) {
      throw new Error(
        `Duplicate image reference detected: URL '${img.secureUrl}' is included more than once.`
      );
    }
    seenUrls.add(img.secureUrl);
  }

  const primaryCount = images.filter((img) => img.isPrimary).length;
  if (primaryCount > 1) {
    throw new Error("A property cannot have more than one primary image.");
  }

  if (status === "Published") {
    if (images.length === 0) {
      throw new Error("Published properties must have at least one image.");
    }
    if (primaryCount !== 1) {
      throw new Error(
        "Published properties must have exactly one primary image designated."
      );
    }
  }
}

/**
 * Safely cleans up removed Cloudinary assets after a property is successfully updated:
 * 1. Checks if the removed asset is referenced by any other property.
 * 2. Deletes from Cloudinary only if unshared.
 * 3. Never throws; logs cleanup failures for audit and manual review.
 */
export async function cleanupRemovedCloudinaryAssets(
  propertyId: string | Types.ObjectId,
  oldImages: { cloudinaryPublicId: string }[],
  newImages: { cloudinaryPublicId: string }[]
): Promise<void> {
  const newPublicIdSet = new Set(
    newImages.map((img) => img.cloudinaryPublicId)
  );
  const removedPublicIds = oldImages
    .map((img) => img.cloudinaryPublicId)
    .filter((id) => id && !newPublicIdSet.has(id));

  for (const publicId of removedPublicIds) {
    try {
      // 1. Check if any other property references this asset
      const propertyFilter: QueryFilter<IProperty> = {
        _id: { $ne: propertyId as any },
        "images.cloudinaryPublicId": publicId,
      };
      const isSharedWithProperty = await Property.findOne(propertyFilter)
        .select("_id")
        .lean();

      if (isSharedWithProperty) {
        console.info(
          `Asset '${publicId}' is shared with another property; skipping Cloudinary deletion.`
        );
        continue;
      }

      // 2. Check if any partner references this asset as logo
      const isSharedWithPartner = await Partner.findOne({
        "logoAsset.cloudinaryPublicId": publicId,
      })
        .select("_id")
        .lean();

      if (isSharedWithPartner) {
        console.info(
          `Asset '${publicId}' is referenced as a partner logo; skipping Cloudinary deletion.`
        );
        continue;
      }

      // 3. Check if site settings reference this asset as brand logo
      const isSharedWithSettings = await SiteSettings.findOne({
        "logoAsset.cloudinaryPublicId": publicId,
      })
        .select("_id")
        .lean();

      if (isSharedWithSettings) {
        console.info(
          `Asset '${publicId}' is referenced in site settings; skipping Cloudinary deletion.`
        );
        continue;
      }

      // 4. Safe deletion
      const result = await cloudinary.uploader.destroy(publicId);
      console.info(
        `Deleted unreferenced Cloudinary asset '${publicId}':`,
        result
      );
    } catch (err) {
      // Log failure safely; do not throw to prevent corrupting property transaction
      console.error(
        `Failed to clean up Cloudinary asset '${publicId}'. Retained for manual review:`,
        err
      );
      try {
        await AuditLog.create({
          actorClerkUserId: "SYSTEM_CLEANUP",
          action: "CLOUDINARY_CLEANUP_FAILED",
          entityType: "Property",
          entityId: propertyId.toString(),
          changeSummary: {
            publicId,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      } catch (logErr) {
        console.error("Failed to write audit log for failed cleanup:", logErr);
      }
    }
  }
}
