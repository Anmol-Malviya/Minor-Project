import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    message: "REALITY DREAMS API is running",
    timestamp: new Date().toISOString(),
  });
});

export default healthRouter;
