import { Router } from "express";
import {
  listRolesController,
  getRoleController,
  upsertRoleController,
  deleteRoleController,
} from "../controllers/roles.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { anyOf, allowAdmin } from "../middlewares/policy.js";

const r = Router();
r.use(requireAuth);

r.get("/", ...listRolesController);
r.get("/:id", ...getRoleController);

r.post("/", anyOf(allowAdmin), ...upsertRoleController);
r.patch("/:id", anyOf(allowAdmin), ...upsertRoleController);
r.delete("/:id", anyOf(allowAdmin), ...deleteRoleController);

export default r;
