const ALLOWED = new Set(["admin", "user"]);

export async function listRolesService({ prisma }) {
  return prisma.role.findMany({ orderBy: { id: "asc" } });
}

export async function upsertRoleService({ prisma, body }) {
  const { name, labelTh, labelEn } = body || {};
  if (!name) throw new Error("name required");
  const key = String(name).toLowerCase();
  if (!ALLOWED.has(key)) {
    throw new Error("ROLE_NOT_ALLOWED"); // อนุญาตเฉพาะ 'admin' | 'user'
  }
  return prisma.role.upsert({
    where: { name: key },
    update: { labelTh, labelEn },
    create: { name: key, labelTh: labelTh || key, labelEn: labelEn || key },
  });
}

export async function deleteRoleService({ prisma, name }) {
  const key = String(name).toLowerCase();
  if (!ALLOWED.has(key)) throw new Error("ROLE_NOT_ALLOWED");
  // ไม่แนะนำให้ลบ role ที่ใช้งานอยู่ — หากต้องการ บังคับตรวจ referential ก่อน
  await prisma.role.delete({ where: { name: key } });
}