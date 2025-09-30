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
      labelTh: body?.labelTh ?? null,
      labelEn: body?.labelEn ?? null,
    },
    create: {
      name: nameKey,
      labelTh: body?.labelTh ?? nameKey,
      labelEn: body?.labelEn ?? nameKey,
    },
  });
}

export async function deleteRoleService({ id, prisma = defaultPrisma }) {
  const rid = Number(id);
  if (!Number.isFinite(rid)) {
    throw AppError.badRequest("id ไม่ถูกต้อง");
  }

  const inUse = await prisma.user.count({ where: { roleId: rid } });
  if (inUse > 0) {
    throw AppError.conflict("มีผู้ใช้งานสิทธิ์นี้อยู่ ไม่สามารถลบได้");
  }

  await prisma.role.delete({ where: { id: rid } });
  return { ok: true };
}
