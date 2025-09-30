import { Router } from "express";
import {
  listDepartmentsController,
  getDepartmentController,
  upsertDepartmentController,
  deleteDepartmentController,
} from "./controller.js";
import { requireAuth } from "#mw/auth.js";
import { anyOf, allowAdmin } from "#mw/policy.js";

const r = Router();
r.use(requireAuth);

r.get("/", ...listDepartmentsController);
r.get("/:id", ...getDepartmentController);

r.post("/",  anyOf(allowAdmin), ...upsertDepartmentController);
r.patch("/:id", anyOf(allowAdmin), ...upsertDepartmentController);
r.delete("/:id", anyOf(allowAdmin), ...deleteDepartmentController);

export default r;
