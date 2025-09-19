import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { UPLOADS_BASE, AVATAR_BASE, SIGNATURE_BASE } from "../config/paths.js";

// helper: ensure dir
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// เขียนเป็น .png แล้วคืน path แบบ "relative ต่อ UPLOADS_BASE"
async function writePngToUserFolder({ buffer, baseDir, userId, filename }) {
  const userDir = path.join(baseDir, String(userId));
  ensureDir(userDir);
  const abs = path.join(userDir, filename.endsWith(".png") ? filename : `${filename}.png`);
  await fs.promises.writeFile(abs, buffer);
  // เก็บเป็น path แบบ POSIX relative ต่อ UPLOADS_BASE (ย้ายโปรเจ็กต์ได้ง่าย)
  const rel = path
    .relative(UPLOADS_BASE, abs)
    .replace(/\\/g, "/"); // normalize ให้เป็น forward-slash
  return { abs, rel };
}

// ========== Avatar ==========
export async function uploadAvatarController(req, res) {
  try {
    const userId = req.user?.id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!req.file) return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE" });
    }

    const { rel } = await writePngToUserFolder({
      buffer: req.file.buffer,
      baseDir: AVATAR_BASE,
      userId,
      filename: "avatar.png",
    });

    // เก็บ path (String) ลง DB: ตัวอย่าง "avatars/3/avatar.png"
    await prisma.user.update({
      where: { id: userId },
      data: { avatarPath: rel },
    });

    res.json({ ok: true, path: rel, url: `/profile/files/user/avatar/${userId}` });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
}

export async function getAvatarFileController(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).end();

    const u = await prisma.user.findUnique({
      where: { id },
      select: { avatarPath: true },
    });

    const rel = u?.avatarPath; // เช่น "avatars/3/avatar.png"
    if (!rel) return res.status(404).end();

    const abs = path.join(UPLOADS_BASE, rel);
    if (!fs.existsSync(abs)) return res.status(404).end();

    res.sendFile(abs);
  } catch (e) {
    res.status(400).end(e?.message || String(e));
  }
}

// ========== Signature (Bytes ใน DB + ไฟล์นอกโปรเจ็กต์เพื่อจัดระเบียบ) ==========
export async function uploadSignatureController(req, res) {
  try {
    const userId = req.user?.id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!req.file) return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
    if (req.file.size > 1 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE" });
    }

    // 1) เขียนไฟล์ไว้ที่ ../upload/signatures/<uid>/signature.png (จัดระเบียบตาม user)
    await writePngToUserFolder({
      buffer: req.file.buffer,
      baseDir: SIGNATURE_BASE,
      userId,
      filename: "signature.png",
    });

    // 2) เก็บ Bytes ลง DB ให้ตรง schema (Prisma Bytes รองรับ Buffer ใน Node)
    await prisma.user.update({
      where: { id: userId },
      data: { signature: req.file.buffer },
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) });
  }
}

export async function getSignatureFileController(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).end();

    const u = await prisma.user.findUnique({
      where: { id },
      select: { signature: true },
    });

    const bytes = u?.signature;
    if (!bytes) return res.status(404).end();

    res.setHeader("Content-Type", "image/png");
    res.send(Buffer.from(bytes));
  } catch (e) {
    res.status(400).end(e?.message || String(e));
  }
}