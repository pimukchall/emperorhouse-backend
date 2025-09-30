import { prisma as defaultPrisma } from "../lib/prisma.js";
import { AppError } from "../utils/appError.js";

export async function listRolesService({ prisma = defaultPrisma } = {}) {
  return prisma.role.findMany({ orderBy: [{ id: "asc" }] });
}

export async function getRoleService({ prisma = defaultPrisma, id }) {
  return prisma.role.findUnique({ where: { id: Number(id) } });
}

export async function upsertRoleService({ prisma = defaultPrisma, body }) {
  const nameKey = String(body?.name || "")
    .trim()
    .toLowerCase();
  if (!nameKey) throw AppError.badRequest("กรุณาระบุชื่อสิทธิ์");

  // กันชื่อเฉพาะระบบ
  if (!["admin", "user"].includes(nameKey)) {
    // ถ้ามีชื่ออื่น ๆ ก็ยังอนุญาตได้หากโปรเจ็กต์ต้องการ
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

export async function deleteRoleService({ prisma = defaultPrisma, id }) {
  const rid = Number(id);
  const inUse = await prisma.user.count({ where: { roleId: rid } });
  if (inUse > 0)
    throw AppError.conflict("มีผู้ใช้งานสิทธิ์นี้อยู่ ไม่สามารถลบได้");
  await prisma.role.delete({ where: { id: rid } });
  return { ok: true };
}
