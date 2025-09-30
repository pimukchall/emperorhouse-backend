import fs from "fs";
import path from "path";
import { prisma } from "#lib/prisma.js";
import { UPLOADS_BASE, AVATAR_BASE, SIGNATURE_BASE } from "#lib/paths.js";

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function relFromUploads(abs) { return path.relative(UPLOADS_BASE, abs).replace(/\\/g, "/"); }

async function writePngToUserFolder({ buffer, baseDir, userId, filename }) {
  const userDir = path.join(baseDir, String(userId));
  ensureDir(userDir);
  const abs = path.join(userDir, filename.endsWith(".png") ? filename : `${filename}.png`);
  await fs.promises.writeFile(abs, buffer);
  return { abs, rel: relFromUploads(abs) };
}

/* -------- Avatar -------- */
export async function saveAvatarService({ userId, fileBuffer, maxSize = 2 * 1024 * 1024 }) {
  if (!userId) { const e = new Error("UNAUTHORIZED"); e.status = 401; throw e; }
  if (!fileBuffer) { const e = new Error("FILE_REQUIRED"); e.status = 400; throw e; }
  if (fileBuffer.length > maxSize) { const e = new Error("FILE_TOO_LARGE"); e.status = 400; throw e; }

  const { rel } = await writePngToUserFolder({ buffer: fileBuffer, baseDir: AVATAR_BASE, userId, filename: "avatar.png" });

  await prisma.user.update({ where: { id: userId }, data: { avatarPath: rel } });
  // ✅ ให้ FE ใช้ <img src="/api/files/avatar/:id">
  return { path: rel, url: `/api/files/avatar/${userId}` };
}

export async function getAvatarFilePathService({ userId }) {
  const u = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { avatarPath: true } });
  const rel = u?.avatarPath;
  if (!rel) { const e = new Error("NOT_FOUND"); e.status = 404; throw e; }
  const abs = path.join(UPLOADS_BASE, rel);
  if (!fs.existsSync(abs)) { const e = new Error("NOT_FOUND"); e.status = 404; throw e; }
  return abs;
}

/* -------- Signature -------- */
export async function saveSignatureService({ userId, fileBuffer, maxSize = 1 * 1024 * 1024 }) {
  if (!userId) { const e = new Error("UNAUTHORIZED"); e.status = 401; throw e; }
  if (!fileBuffer) { const e = new Error("FILE_REQUIRED"); e.status = 400; throw e; }
  if (fileBuffer.length > maxSize) { const e = new Error("FILE_TOO_LARGE"); e.status = 400; throw e; }

  const { rel } = await writePngToUserFolder({ buffer: fileBuffer, baseDir: SIGNATURE_BASE, userId, filename: "signature.png" });

  await prisma.user.update({ where: { id: userId }, data: { signaturePath: rel } });
  // ✅ ให้ FE ใช้ <img src="/api/files/signature/:id">
  return { path: rel, url: `/api/files/signature/${userId}` };
}

export async function getSignatureBytesService({ userId }) {
  // เปลี่ยนจากอ่านจาก DB เป็นอ่านไฟล์ตาม path
  const u = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { signaturePath: true } });
  const rel = u?.signaturePath;
  if (!rel) { const e = new Error("NOT_FOUND"); e.status = 404; throw e; }
  const abs = path.join(UPLOADS_BASE, rel);
  if (!fs.existsSync(abs)) { const e = new Error("NOT_FOUND"); e.status = 404; throw e; }
  return fs.promises.readFile(abs);
}