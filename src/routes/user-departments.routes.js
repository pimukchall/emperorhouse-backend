import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listAssignmentsController,
  addOrUpdateAssignmentController,
  endOrRenameAssignmentController,
  changeLevelController,
} from "../controllers/user-departments.controller.js";

const router = Router({ mergeParams: true });

// รายการ assignment ของ user (ตัวเอง/ตามสิทธิ์) → ต้องล็อกอิน
router.get("/", requireAuth, listAssignmentsController);

// จัดการ assignment (admin)
router.post("/", requireAuth, requireRole("admin"), addOrUpdateAssignmentController);
router.patch("/:udId", requireAuth, requireRole("admin"), endOrRenameAssignmentController);

// promote/demote (admin)
router.post("/:udId/promote", requireAuth, requireRole("admin"), (req, res) =>
  changeLevelController(req, res, "PROMOTE")
);
router.post("/:udId/demote", requireAuth, requireRole("admin"), (req, res) =>
  changeLevelController(req, res, "DEMOTE")
);

export default router;
