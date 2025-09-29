import { prisma as defaultPrisma } from "../prisma.js";
import { AppError } from "../utils/appError.js";
import {
  applyPrismaPagingSort,
  buildListResponse,
} from "../utils/pagination.js";

export async function listOrganizationsService(
  {
    page = 1,
    limit = 20,
    skip = 0,
    sortBy = "createdAt",
    sort = "desc",
    q = "",
    includeDeleted = false,
  } = {},
  { prisma = defaultPrisma } = {}
) {
  const where = {
    ...(includeDeleted ? {} : { deletedAt: null }),
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
    { where },
    { page, limit, skip, sortBy, sort },
    {
      sortMap: {
        createdAt: "createdAt",
        code: "code",
        nameTh: "nameTh",
        nameEn: "nameEn",
        default: "createdAt",
      },
    }
  );

  const [rows, total] = await Promise.all([
    prisma.organization.findMany(args),
    prisma.organization.count({ where }),
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

export async function getOrganizationService({ prisma = defaultPrisma, id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw AppError.badRequest("ไอดีไม่ถูกต้อง");
  return prisma.organization.findUnique({
    where: { id: oid },
    select: {
      id: true,
      code: true,
      nameTh: true,
      nameEn: true,
      deletedAt: true,
    },
  });
}

export async function createOrganizationService({
  prisma = defaultPrisma,
  data,
}) {
  let { code, nameTh, nameEn } = data || {};
  const codeStr = String(code ?? "")
    .trim()
    .toUpperCase();

  if (codeStr !== "") {
    const exists = await prisma.organization.findFirst({
      where: { code: codeStr },
    });
    if (exists) throw AppError.conflict("มีรหัสที่ตั้งนี้ในระบบแล้ว");
  }

  return prisma.organization.create({
    data: {
      code: codeStr === "" ? undefined : codeStr,
      nameTh: typeof nameTh === "undefined" || nameTh === "" ? null : nameTh,
      nameEn: typeof nameEn === "undefined" || nameEn === "" ? null : nameEn,
    },
    select: {
      id: true,
      code: true,
      nameTh: true,
      nameEn: true,
      deletedAt: true,
    },
  });
}

export async function updateOrganizationService({
  prisma = defaultPrisma,
  id,
  data,
}) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw AppError.badRequest("ไอดีไม่ถูกต้อง");

  const { nameTh, nameEn } = data || {};
  const codeStr =
    typeof data?.code === "undefined"
      ? undefined
      : String(data.code ?? "")
          .trim()
          .toUpperCase();

  if (typeof codeStr !== "undefined" && codeStr !== "") {
    const exists = await prisma.organization.findFirst({
      where: { code: codeStr, NOT: { id: oid } },
      select: { id: true },
    });
    if (exists) throw AppError.conflict("มีรหัสที่ตั้งนี้ในระบบแล้ว");
  }

  return prisma.organization.update({
    where: { id: oid },
    data: {
      code:
        typeof codeStr === "undefined"
          ? undefined
          : codeStr === ""
          ? null
          : codeStr,
      nameTh: typeof nameTh === "undefined" ? undefined : nameTh || null,
      nameEn: typeof nameEn === "undefined" ? undefined : nameEn || null,
    },
    select: {
      id: true,
      code: true,
      nameTh: true,
      nameEn: true,
      deletedAt: true,
    },
  });
}

export async function softDeleteOrganizationService({
  prisma = defaultPrisma,
  id,
}) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw AppError.badRequest("ไอดีไม่ถูกต้อง");

  const inUse = await prisma.user.count({
    where: { orgId: oid, deletedAt: null },
  });
  if (inUse > 0)
    throw AppError.conflict("ไม่สามารถลบได้: มีผู้ใช้สังกัดองค์กรนี้");

  await prisma.organization.update({
    where: { id: oid },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

export async function restoreOrganizationService({
  prisma = defaultPrisma,
  id,
}) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw AppError.badRequest("ไอดีไม่ถูกต้อง");
  await prisma.organization.update({
    where: { id: oid },
    data: { deletedAt: null },
  });
  return { ok: true };
}

export async function hardDeleteOrganizationService({
  prisma = defaultPrisma,
  id,
}) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw AppError.badRequest("ไอดีไม่ถูกต้อง");
  const usersCount = await prisma.user.count({ where: { orgId: oid } });
  if (usersCount > 0)
    throw AppError.conflict("ที่ตั้งนี้มีผู้ใช้งานอยู่ ไม่สามารถลบได้");
  await prisma.organization.delete({ where: { id: oid } });
  return { ok: true };
}
