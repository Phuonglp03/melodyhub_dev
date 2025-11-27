import express from "express";
import middlewareController from "../middleware/auth.js";
import { bulkUpdateTimelineItems } from "../controllers/projectController.js";

const { verifyToken } = middlewareController;
const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Bulk update timeline items for a project
router.put("/:projectId/timeline/items/bulk", bulkUpdateTimelineItems);

export default router;


