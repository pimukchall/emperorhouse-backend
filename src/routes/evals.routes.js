// src/routes/evals.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
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
router.use(requireAuth);

// LIST / FILTER
router.get("/", listEvalsController);

// READ
router.get("/:id", getEvalController);

// CREATE
router.post("/", createEvalController);

// UPDATE (DRAFT/REJECTED only by owner)
router.put("/:id", updateEvalController);

// TRANSITIONS
router.post("/:id/submit", submitEvalController);
router.post("/:id/approve", approveManagerController);
router.post("/:id/md-approve", approveMDController);
router.post("/:id/reject", rejectEvalController);

// DELETE (ตามสิทธิ์ใน service/route ชั้นบน)
router.delete("/:id", deleteEvalController);

// ELIGIBLE (ใครที่ฉันสร้างให้ได้ในรอบนี้)
router.get("/eligible/:cycleId", listEligibleController);

export default router;
