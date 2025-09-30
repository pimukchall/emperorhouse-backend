import { Router } from "express";
import {
  listAssignmentsController,
  listByUserController,
  addOrUpdateAssignmentController,
  changeLevelController,
  endOrRenameAssignmentController,
  setPrimaryController,
} from "./controller.js";
import { requireAuth, requireMe } from "#mw/auth.js";
import { canWriteUserDepartment } from "#mw/policy.js";
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";

const r = Router();
r.use(requireAuth, requireMe);

// read (login users)
r.get("/:id", validate(S.UserParam, "params"), validate(S.ListQuery, "query"), ...listAssignmentsController);
r.get("/users/:userId", validate(S.UserParam2, "params"), validate(S.ListQuery, "query"), ...listByUserController);

// write: admin | manager(target dept) ; MD(MGT) ห้าม write
r.post("/", canWriteUserDepartment(), validate(S.AssignBody), ...addOrUpdateAssignmentController);

r.patch("/:udId",
  canWriteUserDepartment(async (req) => {
    // ใช้ departmentId จาก udId (เพื่อให้ policy เช็กได้)
    return Number(req.params.udId);
  }),
  validate(S.UdParam, "params"),
  validate(S.EndOrRenameBody),
  ...endOrRenameAssignmentController
);

r.post("/change-level",
  canWriteUserDepartment(async (req) => {
    // resolve dept จาก udId ใน body
    return Number(req.body?.udId);
  }),
  validate(S.ChangeLevelBody),
  ...changeLevelController
);

r.post("/users/:userId/primary/:udId",
  canWriteUserDepartment(async (_req) => {
    // policy จะ resolve deptId ภายในจาก udId อยู่แล้ว
    return null;
  }),
  validate(S.SetPrimaryParams, "params"),
  ...setPrimaryController
);

export default r;
