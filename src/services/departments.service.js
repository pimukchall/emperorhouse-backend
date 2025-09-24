export async function listDepartmentsService({ prisma }) {
  return prisma.department.findMany({ orderBy: [{ code: "asc" }] });
}
export async function getDepartmentService({ prisma, id }) {
  return prisma.department.findUnique({ where: { id } });
}
export async function upsertDepartmentService({ prisma, body }) {
  const { code, nameTh, nameEn } = body || {};
  if (!code || !nameTh || !nameEn)
    throw new Error("ต้องระบุ code, nameTh, nameEn");
  return prisma.department.upsert({
    where: { code },
    update: { nameTh, nameEn },
    create: { code, nameTh, nameEn },
  });
}
export async function deleteDepartmentService({ prisma, id }) {
  const inUse = await prisma.userDepartment.count({
    where: { departmentId: Number(id), endedAt: null, isActive: true, isActive: true },
  });
  if (inUse > 0) {
    const err = new Error("ไม่สามารถลบแผนกที่มีพนักงานอยู่ได้");
    err.status = 409;
    throw err;
  }
  await prisma.department.delete({ where: { id: Number(id) } });
}
