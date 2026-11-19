import { Router } from "express";
import { getPublicPartners } from "../controllers/partner.controller";

const router = Router();

// Public partner directory for homepage display (SRS Section 8.4)
router.get("/", getPublicPartners);

export default router;

