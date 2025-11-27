import { Router } from "express";
import { listChords } from "../controllers/chordController.js";

const router = Router();

router.get("/", listChords);

export default router;

