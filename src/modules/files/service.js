import fs from "node:fs";
import path from "node:path";
import { prisma as defaultPrisma } from "#lib/prisma.js";
import { UPLOADS_BASE, AVATAR_BASE, SIGNATURE_BASE, ensureUploadDirs } from "#lib/paths.js";
import { AppError } from "#utils/appError.js";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function relFromUploads(abs) {
  return path.relative(UPLOADS_BASE, abs).replace(/\\/g, "/");
}

async function writePngToUserFolder({ buffer, baseDir, userId, filename }) {
  if (!buffer?.length) throw AppError.badRequest("ไฟล์ไม่ถูกต้อง");
  ensureDir(baseDir);
  const userDir = path.join(baseDir, String(userId));
  ensureDir(userDir);
  const abs = path.join(userDir, filename.endsWith(".png") ? filename : `${filename}.png`);
  await fs.promises.writeFile(abs, buffer);
  return { abs, rel: relFromUploads(abs) };
}

/* ========== Avatar ========== */
export async function saveAvatarService(
  { userId, fileBuffer, maxSize = 2 * 1024 * 1024 },
  { prisma = defaultPrisma } = {}
) {
  if (!userId) throw AppError.unauthorized();
  if (!fileBuffer) throw AppError.badRequest("กรุณาเลือกไฟล์");
  if (fileBuffer.length > maxSize) throw AppError.badRequest("ไฟล์ใหญ่เกินกำหนด");

  ensureUploadDirs();

  const { rel } = await writePngToUserFolder({
    buffer: fileBuffer,
    baseDir: AVATAR_BASE,
    userId,
    filename: "avatar.png",
  });

  await prisma.user.update({ where: { id: userId }, data: { avatarPath: rel } });
  return { path: rel, url: `/api/files/avatar/${userId}` };
}

export async function getAvatarFilePathService(
  { userId },
  { prisma = defaultPrisma } = {}
) {
  const u = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { avatarPath: true },
  });
  const rel = u?.avatarPath;
  if (!rel) throw AppError.notFound("ไม่พบรูปภาพ");
  const abs = path.join(UPLOADS_BASE, rel);
  if (!fs.existsSync(abs)) throw AppError.notFound("ไม่พบไฟล์");
  return abs;
}

/* ========== Signature ========== */
export async function saveSignatureService(
  { userId, fileBuffer, maxSize = 1 * 1024 * 1024 },
  { prisma = defaultPrisma } = {}
) {
  if (!userId) throw AppError.unauthorized();
  if (!fileBuffer) throw AppError.badRequest("กรุณาเลือกไฟล์");
  if (fileBuffer.length > maxSize) throw AppError.badRequest("ไฟล์ใหญ่เกินกำหนด");

  // เก็บลงคอลัมน์ Bytes โดยตรง
  await prisma.user.update({
    where: { id: Number(userId) },
    data: { signature: fileBuffer },
  });

  // URL เดิมยังใช้ได้เหมือนเดิม
  return { url: `/api/files/signature/${userId}` };
}

export async function getSignatureBytesService(
  { userId },
  { prisma = defaultPrisma } = {}
) {
  const u = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { signature: true },
  });
  const bytes = u?.signature;
  if (!bytes) throw AppError.notFound("ไม่พบลายเซ็น");

  // prisma คืนมาเป็น Buffer อยู่แล้ว (MySQL: LONGBLOB)
  return bytes; // คืน Buffer ให้ controller ส่งเป็น image/png
}
