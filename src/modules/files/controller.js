import { asyncHandler } from "#utils/asyncHandler.js";
import {
  saveAvatarService,
  getAvatarFilePathService,
  saveSignatureService,
  getSignatureBytesService,
} from "./service.js";

/* -------- Avatar -------- */

// POST /api/files/avatar  (expects req.file by multer memoryStorage)
export const uploadAvatarController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.user?.id || req.userId || req.auth?.sub);
    const file = req.file;
    const out = await saveAvatarService({ userId, fileBuffer: file?.buffer });
    res.json({ ok: true, ...out });
  }),
];

// GET /api/files/avatar/:id
export const getAvatarFileController = [
  asyncHandler(async (req, res) => {
    const abs = await getAvatarFilePathService({ userId: Number(req.params.id) });
    res.sendFile(abs);
  }),
];

/* -------- Signature -------- */

// POST /api/files/signature  (expects req.file by multer memoryStorage)
export const uploadSignatureController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.user?.id || req.userId || req.auth?.sub);
    const file = req.file;
    await saveSignatureService({ userId, fileBuffer: file?.buffer });
    res.json({ ok: true });
  }),
];

// GET /api/files/signature/:id
export const getSignatureFileController = [
  asyncHandler(async (req, res) => {
    const bytes = await getSignatureBytesService({ userId: Number(req.params.id) });
    res.setHeader("Content-Type", "image/png");
    res.send(bytes);
  }),
];
