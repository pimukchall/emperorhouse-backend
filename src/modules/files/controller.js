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
    return res.json({ ok: true, ...out }); // ✅ return กันเผื่อ middleware อื่นส่งซ้ำ
  }),
];

// GET /api/files/avatar/:id
export const getAvatarFileController = [
  asyncHandler(async (req, res, next) => {
    const userId = Number(req.params.id);
    const abs = await getAvatarFilePathService({ userId });

    // ป้องกันเคส client ปิดการเชื่อมต่อกลางคัน
    const onAborted = () => {
      // ห้ามเขียน header/บอดีเพิ่มหลังจากนี้
    };
    req.on("aborted", onAborted);

    res.sendFile(abs, (err) => {
      req.off?.("aborted", onAborted);
      if (!err) return;

      // ถ้า header ส่งไปแล้ว ห้าม setHeader/ส่ง json อีก
      if (res.headersSent || res.writableEnded) {
        // ทำได้แค่ log/จบ ไม่ต้องส่งอะไรเพิ่ม
        return;
      }
      // ส่งให้ error middleware จัดการ
      return next(err);
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
    return res.json({ ok: true }); // ✅ return
  }),
];

// GET /api/files/signature/:id
export const getSignatureFileController = [
  asyncHandler(async (req, res, next) => {
    try {
      const userId = Number(req.params.id);

      // ถ้าลูกค้ายกเลิก ไม่ควรเขียน header/บอดี
      let aborted = false;
      const onAborted = () => { aborted = true; };
      req.on("aborted", onAborted);

      const bytes = await getSignatureBytesService({ userId });
      if (aborted) return; // ลูกค้ายกเลิกแล้ว ไม่ต้องส่งอะไร

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return res.send(bytes);
    } catch (err) {
      if (!res.headersSent) return next(err);
    }
  }),
];
