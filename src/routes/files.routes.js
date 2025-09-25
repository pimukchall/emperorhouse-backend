import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  uploadAvatarSingle,
  uploadSignatureSingle,
} from "../middlewares/upload.js";
import {
  uploadAvatarController,
  getAvatarFileController,
  uploadSignatureController,
  getSignatureFileController,
} from "../controllers/files.controller.js";

const router = Router();

/**
 * ───────────────── Avatar ─────────────────
 * PUT /api/profile/files/user/avatar      (multipart field: "avatar")
 * GET /api/profile/files/user/avatar/:id  → redirect ไปลิงก์ไฟล์ (PUBLIC)
 */
router.put(
  "/profile/files/user/avatar",
  requireAuth,
  uploadAvatarSingle,
  uploadAvatarController
);
router.get("/profile/files/user/avatar/:id", getAvatarFileController);

/**
 * ───────────────── Signature ─────────────────
 * PUT /api/profile/files/user/signature   (multipart field: "signature" หรือ JSON {signature: base64})
 * GET /api/profile/files/user/signature/:id → ส่ง image/png จาก Bytes ใน DB (PUBLIC)
 */
router.put(
  "/profile/files/user/signature",
  requireAuth,
  uploadSignatureSingle,
  uploadSignatureController
);
router.get("/profile/files/user/signature/:id", getSignatureFileController);

/**
 * ───────────────── Backward-compatible aliases ─────────────────
 * สำหรับ FE เก่า ที่เรียก /api/profile/avatar และ /api/profile/signature
 */
router.put(
  "/profile/avatar",
  requireAuth,
  uploadAvatarSingle,
  uploadAvatarController
);
router.put(
  "/profile/signature",
  requireAuth,
  uploadSignatureSingle,
  uploadSignatureController
);

export default router;
