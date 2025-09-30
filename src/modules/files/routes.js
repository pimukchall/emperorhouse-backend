import { Router } from "express";
import { requireAuth } from "#mw/auth.js";
import {
  uploadAvatarSingle,
  uploadSignatureSingle,
} from "#mw/upload.js";
import {
  uploadAvatarController,
  getAvatarFileController,
  uploadSignatureController,
  getSignatureFileController,
} from "./controller.js";

const router = Router();

// ---------- Avatar ----------
router.post(
  "/avatar",
  requireAuth,
  uploadAvatarSingle,
  ...uploadAvatarController
);
router.get("/avatar/:id", ...getAvatarFileController);

// ---------- Signature ----------
router.post(
  "/signature",
  requireAuth,
  uploadSignatureSingle,
  ...uploadSignatureController
);
router.get("/signature/:id", ...getSignatureFileController);

export default router;