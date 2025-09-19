import { prisma } from "../prisma.js";

function pickSort(field, allowed) {
  const f = String(field || "");
  return allowed.includes(f) ? f : allowed[0];
}

export async function listOrganizationsService({
  page = 1,
  limit = 20,
  q = "",
  includeDeleted = false,
  sortBy = "id",
  sort = "asc",
}) {
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  const skip = (p - 1) * l;

  const where = {
    AND: [
      includeDeleted ? {} : { deletedAt: null },
      q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { nameTh: { contains: q, mode: "insensitive" } },
              { nameEn: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const sortField = pickSort(sortBy, ["id", "code", "nameTh", "nameEn", "createdAt"]);
  const orderBy = { [sortField]: String(sort).toLowerCase() === "desc" ? "desc" : "asc" };

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy,
      skip,
      take: l,
      select: { id: true, code: true, nameTh: true, nameEn: true, deletedAt: true },
    }),
    prisma.organization.count({ where }),
  ]);

  return { items, meta: { page: p, pages: Math.ceil(total / l) || 1, total } };
}

export async function getOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("INVALID_ID");
  return prisma.organization.findUnique({
    where: { id: oid },
    select: { id: true, code: true, nameTh: true, nameEn: true, deletedAt: true },
  });
}

export async function createOrganizationService({ data }) {
  const { code, nameTh, nameEn } = data || {};
  // กันซ้ำ code (ถ้ากำหนด)
  if (code) {
    const exists = await prisma.organization.findFirst({ where: { code } });
    if (exists) {
      const err = new Error("ORG_CODE_EXISTS");
      err.status = 409;
      throw err;
    }
  }
  return prisma.organization.create({
    data: {
      code: code || null,
      nameTh: nameTh || null,
      nameEn: nameEn || null,
    },
    select: { id: true, code: true, nameTh: true, nameEn: true, deletedAt: true },
  });
}

export async function updateOrganizationService({ id, data }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("INVALID_ID");
  const { code, nameTh, nameEn } = data || {};

  // กันซ้ำ code กับตัวอื่น
  if (typeof code !== "undefined" && code) {
    const exists = await prisma.organization.findFirst({
      where: { code, NOT: { id: oid } },
      select: { id: true },
    });
    if (exists) {
      const err = new Error("ORG_CODE_EXISTS");
      err.status = 409;
      throw err;
    }
  }

  return prisma.organization.update({
    where: { id: oid },
    data: {
      code: typeof code === "undefined" ? undefined : (code || null),
      nameTh: typeof nameTh === "undefined" ? undefined : (nameTh || null),
      nameEn: typeof nameEn === "undefined" ? undefined : (nameEn || null),
    },
    select: { id: true, code: true, nameTh: true, nameEn: true, deletedAt: true },
  });
}

export async function softDeleteOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("INVALID_ID");
  return prisma.organization.update({
    where: { id: oid },
    data: { deletedAt: new Date() },
    select: { id: true },
  });
}

export async function restoreOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("INVALID_ID");
  return prisma.organization.update({
    where: { id: oid },
    data: { deletedAt: null },
    select: { id: true },
  });
}

export async function hardDeleteOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("INVALID_ID");
  // ถ้าต้องการป้องกันการลบเมื่อยังมีผู้ใช้ผูก org นี้ ให้เช็คก่อน
  const usersCount = await prisma.user.count({ where: { orgId: oid } });
  if (usersCount > 0) {
    const err = new Error("ORG_IN_USE");
    err.status = 409;
    throw err;
  }
  return prisma.organization.delete({ where: { id: oid }, select: { id: true } });
}