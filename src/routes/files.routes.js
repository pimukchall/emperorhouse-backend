import { Router } from "express";

// ✅ ใช้ middleware อัปโหลดจาก upload.js (memory storage + filter + limit)
import {
  uploadAvatarSingle,
  uploadSignatureSingle,
} from "../middlewares/upload.js";

// controllers
import {
  uploadAvatarController,
  getAvatarFileController,
  uploadSignatureController,
  getSignatureFileController,
} from "../controllers/files.controller.js";

// ✅ requireAuth รองรับทั้ง req.user และ req.session.user
function requireAuth(req, res, next) {
  const u = req.user || req.session?.user;
  if (!u?.id) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  req.user = u; // map ให้ downstream ใช้ req.user ได้เสมอ
  next();
}

const router = Router();

// Avatar
router.put("/profile/avatar", requireAuth, uploadAvatarSingle, uploadAvatarController);
router.get("/profile/files/user/avatar/:id", getAvatarFileController);

// Signature
router.put("/profile/signature", requireAuth, uploadSignatureSingle, uploadSignatureController);
router.get("/profile/files/user/signature/:id", getSignatureFileController);

export default router;