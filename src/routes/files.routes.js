import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { uploadAvatarSingle } from "../middlewares/upload.js";
import {
  getProfileController,
  updateProfileController,
  saveSignatureController,
  uploadAvatarController,
  getAvatarFileController,
} from "../controllers/files.controller.js";

const router = Router();

router.get("/", requireAuth, getProfileController);
router.patch("/", requireAuth, updateProfileController);
router.post("/signature", requireAuth, saveSignatureController);

// อัปโหลด avatar (field: "avatar")
router.put(
  "/avatar",
  requireAuth,
  (req, res, next) => {
    uploadAvatarSingle(req, res, (err) => {
      if (err) return res.status(400).json({ ok: false, error: err.message });
      next();
    });
  },
  uploadAvatarController
);

// เสิร์ฟไฟล์ avatar ของ user ตาม id
router.get("/avatar/:id", requireAuth, getAvatarFileController);

export default router;
