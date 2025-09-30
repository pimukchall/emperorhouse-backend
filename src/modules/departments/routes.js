import { Router } from "express";
import {
  listDepartmentsController,
  getDepartmentController,
  upsertDepartmentController,
  deleteDepartmentController,
} from "./controller.js";
import { requireAuth } from "#mw/auth.js";
import { anyOf, allowAdmin } from "#mw/policy.js";
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";

const r = Router();
r.use(requireAuth);

r.get("/", validate(S.DeptListQuery, "query"), ...listDepartmentsController);
r.get("/:id", validate(S.DeptParams, "params"), ...getDepartmentController);

r.post("/", anyOf(allowAdmin), validate(S.DeptUpsert), ...upsertDepartmentController);
r.patch("/:id",
  anyOf(allowAdmin),
  validate(S.DeptParams, "params"),
  validate(S.DeptUpsert),
  ...upsertDepartmentController
);
r.delete("/:id", anyOf(allowAdmin), validate(S.DeptParams, "params"), ...deleteDepartmentController);

export default r;
