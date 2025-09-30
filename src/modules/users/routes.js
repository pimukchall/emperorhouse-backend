import { Router } from "express";
import {
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  softDeleteUserController,
  restoreUserController,
  setPrimaryDepartmentController,
  selfUpdateProfileController,
} from "./controller.js";
import { requireAuth, requireMe } from "#mw/auth.js";
import { canWriteUser } from "#mw/policy.js";
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";

const r = Router();
r.use(requireAuth, requireMe);

// read
r.get("/", validate(S.UserListQuery, "query"), ...listUsersController);
r.get("/:id", validate(S.UserParams, "params"), ...getUserController);

// ผู้ใช้แก้ไขข้อมูลตนเอง
r.patch("/me", validate(S.SelfUpdate), ...selfUpdateProfileController);

// write: admin | owner | manager(same dept) ; MD(MGT) ห้าม write
r.post("/", canWriteUser(), validate(S.UserCreate), ...createUserController);
r.patch("/:id",
  canWriteUser(),
  validate(S.UserParams, "params"),
  validate(S.UserUpdate),
  ...updateUserController
);
r.delete("/:id",
  canWriteUser(),
  validate(S.UserParams, "params"),
  validate(S.DeleteQuery, "query"),
  ...softDeleteUserController
);
r.post("/:id/restore",
  canWriteUser(),
  validate(S.UserParams, "params"),
  ...restoreUserController
);
r.post("/:id/primary-department",
  canWriteUser(),
  validate(S.UserParams, "params"),
  validate(S.SetPrimaryDept),
  ...setPrimaryDepartmentController
);

export default r;
