const ALLOWED = new Set(["admin", "user"]);

export async function listRolesService({ prisma }) {
  return prisma.role.findMany({ orderBy: { id: "asc" } });
}

export async function upsertRoleService({ prisma, body }) {
  const { name, labelTh, labelEn } = body || {};
  if (!name) throw new Error("กรุณาระบุชื่อสิทธิ์");
  const key = String(name).toLowerCase();
  if (!ALLOWED.has(key)) {
    throw new Error("ไม่อนุญาตให้เพิ่มสิทธิ์นอกจาก admin, user");
  }
  return prisma.role.upsert({
    where: { name: key },
    update: { labelTh, labelEn },
    create: { name: key, labelTh: labelTh || key, labelEn: labelEn || key },
  });
}

export async function deleteRoleService({ prisma, name }) {
  const key = String(name).toLowerCase();
  if (!ALLOWED.has(key)) throw new Error("ไม่อนุญาตให้ลบสิทธินี้");
  const inUse = await prisma.user.count({ where: { role: { name: key } } });
  if (inUse > 0) {
    const err = new Error("สิทธินี้ถูกใช้งานอยู่ ไม่สามารถลบได้");
    err.status = 409;
    throw err;
  }
  await prisma.role.delete({ where: { name: key } });
 }