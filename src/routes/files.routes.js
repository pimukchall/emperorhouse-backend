// src/routes/files.routes.js
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
 * อัปโหลด Avatar (ต้องล็อกอิน)
 * field name: "avatar" (multipart/form-data)
 */
router.put(
  "/profile/files/user/avatar",
  requireAuth,
  uploadAvatarSingle,
  uploadAvatarController
);

/**
 * ดาวน์โหลด Avatar (สาธารณะ)
 */
router.get("/profile/files/user/avatar/:id", getAvatarFileController);

/**
 * อัปโหลด Signature (ต้องล็อกอิน)
 * field name: "signature" (multipart/form-data)
 */
router.put(
  "/profile/files/user/signature",
  requireAuth,
  uploadSignatureSingle,
  uploadSignatureController
);

/**
 * ดาวน์โหลด Signature (สาธารณะ)
 * ส่งเป็น image/png จาก Bytes ใน DB
 */
router.get("/profile/files/user/signature/:id", getSignatureFileController);

export default router;
