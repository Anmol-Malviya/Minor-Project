import { Router } from "express";
import { createEnquiry } from "../controllers/enquiry.controller";
import { optionalAuth } from "../middleware/auth";
import { enquiryLimiter } from "../middleware/rateLimiter";

const router = Router();

// POST /api/v1/enquiries - Public / signed-in enquiry submission (FR-ENQ-001, FR-ENQ-007)
router.post("/", enquiryLimiter, optionalAuth, createEnquiry);

export default router;

