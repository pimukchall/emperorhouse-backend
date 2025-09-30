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
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";

const r = Router();
r.use(requireAuth);

r.get("/", validate(S.CycleListQuery, "query"), ...listCyclesController);
r.get("/:id", validate(S.CycleParams, "params"), ...getCycleController);

r.post("/", anyOf(allowAdmin), validate(S.CycleCreate), ...createCycleController);
r.patch("/:id", anyOf(allowAdmin), validate(S.CycleParams, "params"), validate(S.CycleUpdate), ...updateCycleController);
r.delete("/:id", anyOf(allowAdmin), validate(S.CycleParams, "params"), ...deleteCycleController);

export default r;
