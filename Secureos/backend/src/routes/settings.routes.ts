import { Router } from "express";
import { getPublicSettings } from "../controllers/settings.controller";

const router = Router();

// GET /api/v1/settings - Read public website settings (SRS 8.4, 9.2)
router.get("/", getPublicSettings);

export default router;

