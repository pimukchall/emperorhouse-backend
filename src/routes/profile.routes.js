import { Router } from "express";
import { selfUpdateProfileController } from "../controllers/profile.controller.js";
import { requireAuth, requireMe } from "../middlewares/auth.js";

const r = Router();
r.use(requireAuth, requireMe);

// ผู้ใช้แก้ไขข้อมูลตนเอง
r.patch("/me", ...selfUpdateProfileController);

export default r;
