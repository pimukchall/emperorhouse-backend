import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../prisma.js";

// ---------- paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const UPLOADS_DIR = path.join(ROOT, "uploads");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(UPLOADS_DIR);

async function writeImagePng({ buffer, dstDir, baseName }) {
  ensureDir(dstDir);
  const fileName = `${baseName}.png`;
  const absPath = path.join(dstDir, fileName);
  await fs.promises.writeFile(absPath, buffer);
  const relPath = path.relative(ROOT, absPath).replace(/\\/g, "/");
  return { absPath, relPath };
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

    // บันทึกลงโฟลเดอร์ของ user
    const dir = path.join(UPLOADS_DIR, "avatars", String(userId));
    const { relPath } = await writeImagePng({
      buffer: req.file.buffer,
      dstDir: dir,
      baseName: "avatar",
    });

    await prisma.user.update({
      where: { id: userId },
      data: { avatarPath: relPath }, // เก็บ path เป็น String
    });

    res.json({ ok: true, path: relPath, url: `/${relPath}` });
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
    const rel = u?.avatarPath;
    if (!rel) return res.status(404).end();

    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return res.status(404).end();

    res.sendFile(abs);
  } catch (e) {
    res.status(400).end(e?.message || String(e));
  }
}

// ========== Signature ==========
export async function uploadSignatureController(req, res) {
  try {
    const userId = req.user?.id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!req.file) return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
    if (req.file.size > 1 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE" });
    }

    // บันทึกลงโฟลเดอร์ของ user (เพื่อจัดระเบียบไฟล์ตามที่ต้องการ)
    const dir = path.join(UPLOADS_DIR, "signatures", String(userId));
    await writeImagePng({
      buffer: req.file.buffer,
      dstDir: dir,
      baseName: "signature",
    });

    // เก็บเป็น Bytes ลง DB (กัน error ชนิดข้อมูล)
    await prisma.user.update({
      where: { id: userId },
      data: { signature: req.file.buffer }, // Prisma Bytes รองรับ Buffer โดยตรง
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
