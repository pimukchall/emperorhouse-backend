import { Router } from "express";
import {
  listOrganizationsController,
  getOrganizationController,
  createOrganizationController,
  updateOrganizationController,
  deleteOrganizationController,
  restoreOrganizationController,
} from "./controller.js";
import { requireAuth } from "#mw/auth.js";
import { anyOf, allowAdmin } from "#mw/policy.js";

const r = Router();
r.use(requireAuth);

r.get("/", ...listOrganizationsController);
r.get("/:id", ...getOrganizationController);

r.post("/", anyOf(allowAdmin), ...createOrganizationController);
r.patch("/:id", anyOf(allowAdmin), ...updateOrganizationController);
r.delete("/:id", anyOf(allowAdmin), ...deleteOrganizationController);
r.post("/:id/restore", anyOf(allowAdmin), ...restoreOrganizationController);

export default r;
