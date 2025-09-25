import { Router } from "express";
import { requireAuth, requireRole, requireMe } from "../middlewares/auth.js";
import {
  listEvalsController,
  getEvalController,
  createEvalController,
  updateEvalController,
  deleteEvalController,
  submitEvalController,
  approveManagerController,
  approveMDController,
  rejectEvalController,
  listEligibleController,
} from "../controllers/evals.controller.js";

const router = Router();

// ต้องล็อกอินก่อนทุกเส้นทางในโมดูลนี้ และเติม req.me ให้พร้อมใช้งาน
router.use(requireAuth, requireMe);

// ใส่เส้นทางเฉพาะเจาะจงก่อน เพื่อไม่ให้ชนกับ "/:id"
router.get("/eligible/:cycleId", listEligibleController);

// Core CRUD
router.get("/", listEvalsController);
router.post("/", createEvalController);
router.get("/:id", getEvalController);
router.put("/:id", updateEvalController);
router.delete("/:id", requireRole("admin", "hr"), deleteEvalController);

// Workflow
router.post("/:id/submit", submitEvalController);
router.post("/:id/approve", approveManagerController);
router.post("/:id/md-approve", approveMDController);
router.post("/:id/reject", rejectEvalController);

export default router;
