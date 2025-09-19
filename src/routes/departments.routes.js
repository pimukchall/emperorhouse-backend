import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listDepartmentsController,
  getDepartmentController,
  upsertDepartmentController,
  deleteDepartmentController,
} from "../controllers/departments.controller.js";

const router = Router();

// ต้องล็อกอินเพื่อดูรายการ/ดูรายละเอียด
router.get("/", requireAuth, listDepartmentsController);
router.get("/:id", requireAuth, getDepartmentController);

// admin เท่านั้น (สร้าง/แก้ด้วย upsert)
router.post("/", requireAuth, requireRole("admin"), upsertDepartmentController);

// admin เท่านั้น (ลบ)
router.delete("/:id", requireAuth, requireRole("admin"), deleteDepartmentController);

export default router;
