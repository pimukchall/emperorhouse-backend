import { Router } from "express";
import { requireAuth, requireMe } from "#mw/auth.js";
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";
import {
  listAssignmentsController,
  listByUserController,
  assignController,
  endOrRenameController,
  changeLevelController,
  setPrimaryController,
} from "./controller.js";

const r = Router();

// ทั้งโมดูลนี้ต้องล็อกอิน
r.use(requireAuth, requireMe);

// GET /api/user-departments?q=&page=&limit=&activeOnly=&departmentId=&userId=
r.get("/", validate(S.ListQuery, "query"), ...listAssignmentsController);

// GET /api/user-departments/user/:userId?activeOnly=
r.get(
  "/user/:userId",
  validate(S.ParamsUserId, "params"),
  validate(S.ListByUserQuery, "query"),
  ...listByUserController
);

// POST /api/user-departments/assign
r.post("/assign", validate(S.AssignBody), ...assignController);

// PATCH /api/user-departments/:id/end-or-rename
r.patch(
  "/:id/end-or-rename",
  validate(S.ParamsId, "params"),
  validate(S.EndOrRenameBody),
  ...endOrRenameController
);

// PATCH /api/user-departments/:id/change-level
r.patch(
  "/:id/change-level",
  validate(S.ParamsId, "params"),
  validate(S.ChangeLevelBody),
  ...changeLevelController
);

// PATCH /api/user-departments/:id/set-primary
r.patch("/:id/set-primary", validate(S.ParamsId, "params"), ...setPrimaryController);

export default r;
