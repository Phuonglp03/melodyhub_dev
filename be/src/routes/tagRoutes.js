import { Router } from "express";
import {
  listTags,
  bulkUpsertTags,
  replaceContentTags,
} from "../controllers/tagController.js";

const router = Router();

router.get("/", listTags);
router.post("/bulk-upsert", bulkUpsertTags);
router.put("/content/:type/:id", replaceContentTags);

export default router;
