import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { selfUpdateProfileController } from "../controllers/profile.controller.js";

const router = Router();

// ใช้ PATCH /api/profile (ไม่ต้องมี :id)
router.patch("/", requireAuth, selfUpdateProfileController);

export default router;
export { router };
