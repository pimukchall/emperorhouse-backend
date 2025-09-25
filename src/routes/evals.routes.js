import { Router } from "express";
import { requireAuth, requireMe, requireRole } from "../middlewares/auth.js";
import {
  listEvalsController,
  getEvalController,
  createEvalController,
  updateEvalController,
  submitEvalController,
  approveManagerController,
  approveMDController,
  rejectEvalController,
  deleteEvalController,
  listEligibleController,
} from "../controllers/evals.controller.js";

const router = Router();

// ต้องล็อกอินทุกเส้นทาง และแนบ snapshot me สำหรับกฎ MD/admin/department
router.use(requireAuth, requireMe);

// LIST/FILTER
router.get("/", listEvalsController);

// ✅ ต้องมาก่อน "/:id" ไม่งั้นชนเป็น :id
router.get("/eligible/:cycleId", listEligibleController);

// READ
router.get("/:id", getEvalController);

// CREATE & UPDATE (เงื่อนไขระดับ field จะตรวจใน service/controller อยู่แล้ว)
router.post("/", createEvalController);
router.put("/:id", updateEvalController);

// TRANSITIONS
router.post("/:id/submit", submitEvalController);
router.post("/:id/approve", approveManagerController);
router.post("/:id/md-approve", approveMDController);
router.post("/:id/reject", rejectEvalController);

// DELETE — จำกัดเฉพาะ admin/hr
router.delete("/:id", requireRole("admin", "hr"), deleteEvalController);

export default router;
