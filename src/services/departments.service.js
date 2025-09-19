export async function listDepartmentsService({ prisma }) {
  return prisma.department.findMany({ orderBy: [{ code: "asc" }] });
}
export async function getDepartmentService({ prisma, id }) {
  return prisma.department.findUnique({ where: { id } });
}
export async function upsertDepartmentService({ prisma, body }) {
  const { code, nameTh, nameEn } = body || {};
  if (!code || !nameTh || !nameEn) throw new Error("code, nameTh, nameEn required");
  return prisma.department.upsert({
    where: { code },
    update: { nameTh, nameEn },
    create: { code, nameTh, nameEn },
  });
}
export async function deleteDepartmentService({ prisma, id }) {
  await prisma.department.delete({ where: { id } });
}
