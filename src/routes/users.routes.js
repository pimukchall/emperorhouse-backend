import { Router } from "express";
import {
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  softDeleteUserController,
  setPrimaryDepartmentController,
} from "../controllers/users.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

// อ่านข้อมูล (ต้องล็อกอิน)
router.get("/", requireAuth, listUsersController);
router.get("/:id", requireAuth, getUserController);

// แก้ไขข้อมูล (admin เท่านั้น)
router.post("/", requireAuth, requireRole("admin"), createUserController);
router.patch("/:id", requireAuth, requireRole("admin"), updateUserController);
router.delete("/:id", requireAuth, requireRole("admin"), softDeleteUserController);
router.post("/:id/primary/:udId", requireAuth, requireRole("admin"), setPrimaryDepartmentController);

export default router;
