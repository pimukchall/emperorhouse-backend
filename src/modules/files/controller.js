import { asyncHandler } from "#utils/asyncHandler.js";
import {
  saveAvatarService,
  getAvatarFilePathService,
  saveSignatureService,
  getSignatureBytesService,
} from "./service.js";

/* -------- Avatar -------- */

// POST /api/files/avatar
export const uploadAvatarController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.user?.id || req.userId || req.auth?.sub);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const file = req.file;
    if (!file?.buffer) return res.status(400).json({ ok: false, error: "กรุณาเลือกรูปโปรไฟล์" });

    const out = await saveAvatarService({ userId, fileBuffer: file.buffer });
    res.json({ ok: true, ...out });
  }),
];

// GET /api/files/avatar/:id
export const getAvatarFileController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const abs = await getAvatarFilePathService({ userId });
    res.sendFile(abs, (err) => {
      if (err) res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    });
  }),
];

/* -------- Signature -------- */

// POST /api/files/signature
export const uploadSignatureController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.user?.id || req.userId || req.auth?.sub);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const file = req.file;
    if (!file?.buffer) return res.status(400).json({ ok: false, error: "กรุณาเลือกลายเซ็น" });

    await saveSignatureService({ userId, fileBuffer: file.buffer });
    res.json({ ok: true });
  }),
];

// GET /api/files/signature/:id
export const getSignatureFileController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const bytes = await getSignatureBytesService({ userId });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(bytes);
  }),
];
