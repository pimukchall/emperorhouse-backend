import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listRolesController,
  upsertRoleController,
  deleteRoleController,
} from "../controllers/roles.controller.js";

const router = Router();

// admin เท่านั้น
router.get("/", requireAuth, requireRole("admin"), listRolesController);
router.post("/", requireAuth, requireRole("admin"), upsertRoleController);
router.delete("/:name", requireAuth, requireRole("admin"), deleteRoleController);

export default router;
