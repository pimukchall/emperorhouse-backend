import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";
import { applyPrismaPagingSort, buildListResponse } from "#utils/pagination.js";

export async function listDepartmentsService(
  { page = 1, limit = 20, skip = 0, sortBy = "code", sort = "asc", q = "" } = {},
  { prisma = defaultPrisma } = {}
) {
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { nameTh: { contains: q, mode: "insensitive" } },
            { nameEn: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const args = applyPrismaPagingSort(
    { where, select: { id: true, code: true, nameTh: true, nameEn: true, createdAt: true, updatedAt: true } },
    { page, limit, skip, sortBy, sort },
    { sortMap: { id: "id", code: "code", nameTh: "nameTh", nameEn: "nameEn", createdAt: "createdAt", updatedAt: "updatedAt", default: "code" } }
  );

  const [rows, total] = await Promise.all([
    prisma.department.findMany(args),
    prisma.department.count({ where }),
  ]);

  return buildListResponse({
    rows,
    total,
    page,
    limit,
    sortBy: Object.keys(args.orderBy || {})[0],
    sort: Object.values(args.orderBy || {})[0],
  });
}

export async function getDepartmentService({ prisma = defaultPrisma, id }) {
  return prisma.department.findUnique({ where: { id: Number(id) } });
}

export async function upsertDepartmentService({ prisma = defaultPrisma, body }) {
  let { code, nameTh, nameEn } = body || {};
  code = String(code || "").trim().toUpperCase();
  if (!code || !nameTh || !nameEn) throw AppError.badRequest("ต้องระบุ code, nameTh, nameEn");
  return prisma.department.upsert({
    where: { code },
    update: { nameTh, nameEn },
    create: { code, nameTh, nameEn },
  });
}

export async function deleteDepartmentService({ prisma = defaultPrisma, id }) {
  const inUse = await prisma.userDepartment.count({ where: { departmentId: Number(id), endedAt: null, isActive: true } });
  if (inUse > 0) throw AppError.conflict("ไม่สามารถลบแผนกที่มีพนักงานอยู่ได้");
  await prisma.department.delete({ where: { id: Number(id) } });
  return { ok: true };
}