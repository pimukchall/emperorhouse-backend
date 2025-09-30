import { Router } from "express";
import { requireAuth } from "#mw/auth.js";
import { validate } from "#mw/validate.js";
import { IdParam } from "./schema.js";
import { uploadAvatarSingle, uploadSignatureSingle } from "#mw/upload.js";
import {
  uploadAvatarController,
  getAvatarFileController,
  uploadSignatureController,
  getSignatureFileController,
} from "./controller.js";

const r = Router();

// ---------- Avatar ----------
r.post("/avatar", requireAuth, uploadAvatarSingle, ...uploadAvatarController);
r.get("/avatar/:id", validate(IdParam, "params"), ...getAvatarFileController);

// ---------- Signature ----------
r.post("/signature", requireAuth, uploadSignatureSingle, ...uploadSignatureController);
r.get("/signature/:id", validate(IdParam, "params"), ...getSignatureFileController);

export default r;
