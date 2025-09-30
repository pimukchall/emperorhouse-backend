import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";
import { applyPrismaPagingSort } from "#utils/pagination.js";

const SELECT = { id: true, code: true, nameTh: true, nameEn: true, createdAt: true, updatedAt: true };

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
    { where, select: SELECT },
    { page, limit, skip, sortBy, sort },
    {
      sortMap: {
        id: "id",
        code: "code",
        nameTh: "nameTh",
        nameEn: "nameEn",
        createdAt: "createdAt",
        updatedAt: "updatedAt",
        default: "code",
      },
    }
  );

  const [rows, total] = await Promise.all([
    prisma.department.findMany(args),
    prisma.department.count({ where }),
  ]);

  const ob = args.orderBy || {};
  return {
    rows,
    total,
    page,
    limit,
    sortBy: Object.keys(ob)[0],
    sort: Object.values(ob)[0],
  };
}

export async function getDepartmentService({ prisma = defaultPrisma, id }) {
  const did = Number(id);
  if (!Number.isFinite(did)) throw AppError.badRequest("id ไม่ถูกต้อง");
  return prisma.department.findUnique({ where: { id: did }, select: SELECT });
}

export async function upsertDepartmentService({ prisma = defaultPrisma, body }) {
  let { code, nameTh, nameEn } = body || {};
  const codeStr = String(code || "").trim().toUpperCase();
  if (!codeStr || !nameTh) throw AppError.badRequest("ต้องระบุ code และ nameTh");

  return prisma.department.upsert({
    where: { code: codeStr },
    update: {
      nameTh,
      nameEn: typeof nameEn === "undefined" ? undefined : (nameEn || null),
    },
    create: {
      code: codeStr,
      nameTh,
      nameEn: nameEn || null,
    },
    select: SELECT,
  });
}

export async function deleteDepartmentService({ prisma = defaultPrisma, id }) {
  const did = Number(id);
  if (!Number.isFinite(did)) throw AppError.badRequest("id ไม่ถูกต้อง");

  const inUse = await prisma.userDepartment.count({
    where: { departmentId: did, endedAt: null, isActive: true },
  });
  if (inUse > 0) throw AppError.conflict("ไม่สามารถลบแผนกที่มีพนักงานอยู่ได้");

  await prisma.department.delete({ where: { id: did } });
  return { ok: true };
}
