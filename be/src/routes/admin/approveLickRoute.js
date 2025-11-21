import express from "express";
import { 
  getPendingLicks, 
  approveLick, 
  rejectLick 
} from "../../controllers/admin/approveLick.js"; // Import đúng đường dẫn
import { verifyToken, isAdmin } from "../../middleware/auth.js";

const router = express.Router();

// Định nghĩa các route Admin
// Các route này sẽ được mount vào prefix mà server.js quy định

// GET /api/licks/pending
router.get("/pending", verifyToken, isAdmin, getPendingLicks);

// PATCH /api/licks/:lickId/approve
router.patch("/:lickId/approve", verifyToken, isAdmin, approveLick);

// PATCH /api/licks/:lickId/reject
router.patch("/:lickId/reject", verifyToken, isAdmin, rejectLick);

export default router;