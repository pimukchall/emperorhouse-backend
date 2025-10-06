import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";

export async function listRolesService({ prisma = defaultPrisma } = {}) {
  return prisma.role.findMany({ orderBy: [{ id: "asc" }] });
}

export async function getRoleService({ id, prisma = defaultPrisma }) {
  // รองรับทั้ง id (เลข) และ name (string)
  const asNum = Number(id);
  const where =
    Number.isFinite(asNum) && `${asNum}` === String(id)
      ? { id: asNum }
      : { name: String(id).trim().toLowerCase() };

  return prisma.role.findUnique({ where });
}

export async function upsertRoleService({ body, prisma = defaultPrisma }) {
  const nameKey = String(body?.name || "").trim().toLowerCase();
  if (!nameKey) throw AppError.badRequest("กรุณาระบุชื่อสิทธิ์");

  // กันชื่อสงวน หากต้องการ (ขยายตามนโยบายทีมได้)
  if (!["admin", "user"].includes(nameKey)) {
    // allow others by business rule
  }

  return prisma.role.upsert({
    where: { name: nameKey },
    update: {
      labelTh: (body?.labelTh ?? null) || null,
      labelEn: (body?.labelEn ?? null) || null,
    },
    create: {
      name: nameKey,
      labelTh: (body?.labelTh ?? nameKey).trim().slice(0, 120),
      labelEn: (body?.labelEn ?? nameKey).trim().slice(0, 120),
    },
  });
}

export async function deleteRoleService({ id, prisma = defaultPrisma }) {
  const rid = Number(id);
  if (!Number.isFinite(rid)) {
    throw AppError.badRequest("id ไม่ถูกต้อง");
  }

  // คิดเฉพาะผู้ใช้ที่ยังไม่ถูกลบ (soft-delete)
  const inUse = await prisma.user.count({ where: { roleId: rid, deletedAt: null } });
  if (inUse > 0) {
    throw AppError.conflict("มีผู้ใช้งานสิทธิ์นี้อยู่ ไม่สามารถลบได้");
  }

    // บล็อกการลบ role พื้นฐาน
  const role = await prisma.role.findUnique({ where: { id: rid }, select: { name: true } });
  if (role?.name === "admin") {
    throw AppError.conflict("ไม่อนุญาตให้ลบสิทธิ์พื้นฐาน");
  }

  await prisma.role.delete({ where: { id: rid } });
  return { ok: true };
}
