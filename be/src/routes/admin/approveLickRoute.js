import express from "express";
import { 
  getPendingLicks, 
  approveLick, 
  rejectLick 
} from "../../controllers/admin/approveLick.js"; // Import đúng đường dẫn
import { verifyToken, isAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/permissions.js";

const router = express.Router();

// Định nghĩa các route Admin
// Các route này sẽ được mount vào prefix mà server.js quy định

// GET /api/licks/pending
// Require manage_content permission (Super Admin và Liveroom Admin)
router.get("/pending", verifyToken, isAdmin, requirePermission('manage_content'), getPendingLicks);

// PATCH /api/licks/:lickId/approve
// Require manage_content permission
router.patch("/:lickId/approve", verifyToken, isAdmin, requirePermission('manage_content'), approveLick);

// PATCH /api/licks/:lickId/reject
// Require manage_content permission
router.patch("/:lickId/reject", verifyToken, isAdmin, requirePermission('manage_content'), rejectLick);

export default router;