import { Router } from "express";
import {
  getMyEnquiries,
  getMyWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../controllers/me.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Enforce authentication on all /api/v1/me/* endpoints
router.use(requireAuth);

// Enquiry History (FR-USR-002, FR-USR-003)
router.get("/enquiries", getMyEnquiries);

// Wishlist Management (FR-USR-002, FR-USR-004, FR-USR-005)
router.get("/wishlist", getMyWishlist);
router.post("/wishlist/:propertyId", addToWishlist);
router.delete("/wishlist/:propertyId", removeFromWishlist);

export default router;

