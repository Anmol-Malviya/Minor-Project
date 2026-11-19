import { Router } from "express";

import {
  getPublishedProperties,
  getPropertyBySlug,
} from "../controllers/property.controller";

const router = Router();

// Public property discovery routes (FR-LST-001, FR-DET-001)
router.get("/", getPublishedProperties);
router.get("/:slug", getPropertyBySlug);

export default router;
