import { prisma as defaultPrisma } from "../prisma.js";
import { AppError } from "../utils/appError.js";
import {
  applyPrismaPagingSort,
  buildListResponse,
} from "../utils/pagination.js";

export async function listDepartmentsService(
  { page = 1, limit = 20, skip = 0, sort = "code", order = "asc" } = {},
  { prisma = defaultPrisma } = {}
) {
  const args = applyPrismaPagingSort(
    {},
    { page, limit, skip, sort, order },
    { sortMap: { code: "code", nameTh: "nameTh", createdAt: "createdAt" } }
  );
  const [rows, total] = await Promise.all([
    prisma.department.findMany(args),
    prisma.department.count(),
  ]);
  return buildListResponse({ rows, total, page, limit });
}

export async function getDepartmentService({ prisma = defaultPrisma, id }) {
  return prisma.department.findUnique({ where: { id: Number(id) } });
}

export async function upsertDepartmentService({
  prisma = defaultPrisma,
  body,
}) {
  let { code, nameTh, nameEn } = body || {};
  code = String(code || "")
    .trim()
    .toUpperCase();
  if (!code || !nameTh || !nameEn)
    throw AppError.badRequest("ต้องระบุ code, nameTh, nameEn");

  return prisma.department.upsert({
    where: { code },
    update: { nameTh, nameEn },
    create: { code, nameTh, nameEn },
  });
}

export async function deleteDepartmentService({ prisma = defaultPrisma, id }) {
  const inUse = await prisma.userDepartment.count({
    where: { departmentId: Number(id), endedAt: null, isActive: true },
  });
  if (inUse > 0) throw AppError.conflict("ไม่สามารถลบแผนกที่มีพนักงานอยู่ได้");
  await prisma.department.delete({ where: { id: Number(id) } });
  return { ok: true };
}
