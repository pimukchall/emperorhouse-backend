import { Router } from "express";
import {
  listCyclesController,
  getCycleController,
  createCycleController,
  updateCycleController,
  deleteCycleController,
} from "./controller.js";
import { requireAuth } from "#mw/auth.js";
import { anyOf, allowAdmin } from "#mw/policy.js";

const r = Router();
r.use(requireAuth);

r.get("/", ...listCyclesController);
r.get("/:id", ...getCycleController);

r.post("/", anyOf(allowAdmin), ...createCycleController);
r.patch("/:id", anyOf(allowAdmin), ...updateCycleController);
r.delete("/:id", anyOf(allowAdmin), ...deleteCycleController);

export default r;
