import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listCyclesController,
  getCycleController,
  createCycleController,
  updateCycleController,
  deleteCycleController,
} from "../controllers/eval-cycles.controller.js";

const router = Router();

// ต้องล็อกอินก่อนทุกเส้นทาง
router.use(requireAuth);

// อ่าน / ค้นหา ใครก็ได้ที่ล็อกอิน
router.get("/", listCyclesController);
router.get("/:id", getCycleController);

// สร้าง/แก้/ลบ — จำกัดเฉพาะ admin หรือ hr
router.post("/", requireRole("admin", "hr"), createCycleController);
router.put("/:id", requireRole("admin", "hr"), updateCycleController);
router.delete("/:id", requireRole("admin", "hr"), deleteCycleController);

export default router;