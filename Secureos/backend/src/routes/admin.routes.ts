import { Router } from "express";
import {
  getAdminProperties,
  getAdminPropertyById,
  createAdminProperty,
  updateAdminProperty,
  archiveAdminProperty,
} from "../controllers/adminProperty.controller";
import { getAdminOverview } from "../controllers/adminOverview.controller";
import {
  getAdminEnquiries,
  getAdminEnquiryById,
  updateAdminEnquiry,
} from "../controllers/adminEnquiry.controller";
import { getAdminUsers } from "../controllers/adminUser.controller";
import {
  getAdminSettings,
  updateAdminSettings,
} from "../controllers/adminSettings.controller";
import {
  getAdminPartners,
  createAdminPartner,
  updateAdminPartner,
  deactivateAdminPartner,
} from "../controllers/adminPartner.controller";
import { generateUploadSignature } from "../controllers/upload.controller";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { uploadSignatureLimiter } from "../middleware/rateLimiter";

const router = Router();

// Strictly enforce authenticated ADMIN access across all /api/v1/admin/* routes (FR-ADM-001)
router.use(requireAuth, requireAdmin);

// Dashboard Overview Metrics (FR-ADM-003, FR-ADM-005, SRS Section 9.2)
router.get("/overview", getAdminOverview);

// Property Management Endpoints (FR-ADM-006 - FR-ADM-014, SRS Section 9.2)
router.get("/properties", getAdminProperties);
router.get("/properties/:id", getAdminPropertyById);
router.post("/properties", createAdminProperty);
router.patch("/properties/:id", updateAdminProperty);
router.delete("/properties/:id", archiveAdminProperty);

// Cloudinary Media Upload Signing (SRS Section 8.3 & 9.2)
router.post("/uploads/signature", uploadSignatureLimiter, generateUploadSignature);

// Customer Enquiry Inbox Management (FR-ADM-017 - FR-ADM-021, SRS Section 9.2)
router.get("/enquiries", getAdminEnquiries);
router.get("/enquiries/:id", getAdminEnquiryById);
router.patch("/enquiries/:id", updateAdminEnquiry);

// Registered User Overview (FR-ADM-022, SRS Section 9.2)
router.get("/users", getAdminUsers);

// Website Configuration & Settings Management (FR-ADM-023, FR-ADM-024, SRS Section 9.2)
router.get("/settings", getAdminSettings);
router.patch("/settings", updateAdminSettings);

// Partner Management Endpoints (SRS Section 8.4 & 9.2)
router.get("/partners", getAdminPartners);
router.post("/partners", createAdminPartner);
router.patch("/partners/:id", updateAdminPartner);
router.delete("/partners/:id", deactivateAdminPartner);

export default router;
