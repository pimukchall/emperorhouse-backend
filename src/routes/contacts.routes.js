import { Router } from "express";
import {
  createContactController,
  listContactsController,
  getContactController,
  deleteContactController,
} from "../controllers/contacts.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

// public (ผู้ใช้ภายนอกส่งข้อความได้)
router.post("/", createContactController);

// admin-only (ดูรายการ + รายละเอียด + ลบ)
router.get("/", requireAuth, requireRole("admin"), listContactsController);
router.get("/:id", requireAuth, requireRole("admin"), getContactController);
router.delete("/:id", requireAuth, requireRole("admin"), deleteContactController);

export default router;
export { router };
