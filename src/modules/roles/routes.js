import { Router } from "express";
import {
  listRolesController,
  getRoleController,
  upsertRoleController,
  deleteRoleController,
} from "./controller.js";
import { requireAuth } from "#mw/auth.js";
import { anyOf, allowAdmin } from "#mw/policy.js";
import { validate } from "#mw/validate.js";
import { RoleParams, RoleUpsert } from "./schema.js";

const r = Router();
r.use(requireAuth);

r.get("/", ...listRolesController);
r.get("/:id", validate(RoleParams, "params"), ...getRoleController);

r.post("/", anyOf(allowAdmin), validate(RoleUpsert), ...upsertRoleController);
r.patch("/:id", anyOf(allowAdmin), validate(RoleUpsert), ...upsertRoleController);
r.delete("/:id", anyOf(allowAdmin), validate(RoleParams, "params"), ...deleteRoleController);

export default r;
