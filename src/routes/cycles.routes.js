// src/routes/cycles.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  listCyclesController,
  getCycleController,
  createCycleController,
  updateCycleController,
  deleteCycleController,
} from "../controllers/eval-cycles.controller.js";

const router = Router();
router.use(requireAuth);

// list cycles
router.get("/", listCyclesController);       
router.get("/:id", getCycleController);
router.post("/", createCycleController);
router.patch("/:id", updateCycleController);
router.delete("/:id", deleteCycleController);

export default router;
