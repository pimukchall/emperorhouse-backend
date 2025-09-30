import { Router } from "express";
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
} from "./controller.js";
import { requireAuth, requireMe } from "#mw/auth.js";
import { canWriteEval, anyOf, allowAdmin, allowMDApproveOnly } from "#mw/policy.js";

const r = Router();
r.use(requireAuth, requireMe);

// read
r.get("/", ...listEvalsController);
r.get("/:id", ...getEvalController);

// write: admin | owner | manager(same dept) ; MD(MGT) ห้าม write
r.post("/",          canWriteEval(), ...createEvalController);
r.patch("/:id",      canWriteEval(), ...updateEvalController);
r.delete("/:id",     canWriteEval(), ...deleteEvalController);
r.post("/:id/submit", canWriteEval(), ...submitEvalController);

// approve/reject: admin หรือ MD(MGT) เท่านั้น
r.post("/:id/approve/manager", anyOf(allowAdmin /* service ยังเช็คว่าเป็น manager ของแบบฟอร์ม */), ...approveManagerController);
r.post("/:id/approve/md",      anyOf(allowAdmin, allowMDApproveOnly), ...approveMDController);
r.post("/:id/reject",          anyOf(allowAdmin, allowMDApproveOnly), ...rejectEvalController);

// eligible
r.get("/eligible/:cycleId", ...listEligibleController);

export default r;
