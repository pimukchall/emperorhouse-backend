import { Router } from "express";
import {
  uploadAvatarController,
  getAvatarFileController,
  uploadSignatureController,
  getSignatureFileController,
} from "../controllers/files.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { memoryUpload } from "../middlewares/upload.js";

const r = Router();

// avatar (generic field: file)
r.post("/avatar", requireAuth, memoryUpload.single("file"), ...uploadAvatarController);
r.get("/avatar/:id", ...getAvatarFileController);

// signature (generic field: file)
r.post("/signature", requireAuth, memoryUpload.single("file"), ...uploadSignatureController);
r.get("/signature/:id", ...getSignatureFileController);

export default r;
