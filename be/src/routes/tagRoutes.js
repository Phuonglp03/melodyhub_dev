import { Router } from "express";
import {
  listTags,
  bulkUpsertTags,
  replaceContentTags,
  searchTags,
} from "../controllers/tagController.js";

const router = Router();

// More specific routes first
router.get("/search", searchTags);
router.get("/", listTags);
router.post("/bulk-upsert", bulkUpsertTags);
router.put("/content/:type/:id", replaceContentTags);

console.log("[TAG ROUTES] Routes registered: GET /search, GET /, POST /bulk-upsert, PUT /content/:type/:id");

export default router;
