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
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";

const r = Router();
r.use(requireAuth, requireMe);

// read
r.get("/", validate(S.ListQuery, "query"), ...listEvalsController);
r.get("/:id", validate(S.IdParam, "params"), ...getEvalController);

// write: admin | owner | manager(same dept) ; MD(MGT) ห้าม write
r.post("/", canWriteEval(), validate(S.Create), ...createEvalController);
r.patch("/:id", canWriteEval(), validate(S.IdParam, "params"), validate(S.Update), ...updateEvalController);
r.delete("/:id", canWriteEval(), validate(S.IdParam, "params"), ...deleteEvalController);
r.post("/:id/submit", canWriteEval(), validate(S.IdParam, "params"), validate(S.SignBody), ...submitEvalController);

// approve/reject: admin หรือ MD(MGT) เท่านั้น
r.post("/:id/approve/manager", anyOf(allowAdmin /* service จะเช็คเพิ่มเติมว่าเป็น manager เจ้าของแบบฟอร์ม */), validate(S.IdParam, "params"), validate(S.SignBody), ...approveManagerController);
r.post("/:id/approve/md",      anyOf(allowAdmin, allowMDApproveOnly), validate(S.IdParam, "params"), validate(S.SignBody), ...approveMDController);
r.post("/:id/reject",          anyOf(allowAdmin, allowMDApproveOnly), validate(S.IdParam, "params"), ...rejectEvalController);

// eligible
r.get("/eligible/:cycleId", validate(S.CycleParam, "params"), ...listEligibleController);

export default r;
