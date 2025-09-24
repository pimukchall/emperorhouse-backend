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
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (p - 1) * l;

  const ors = [];
  const qq = (q || "").trim();

  if (qq) {
    // helper สำหรับ case-insensitive ถ้า Prisma รองรับ
    const ci = (field) => ({ [field]: { contains: qq } });

    ors.push(ci("code"));    // ✅ ค้นหาด้วย code เสมอ (string)
    ors.push(ci("nameTh"));  // ค้นหาชื่อไทย
    ors.push(ci("nameEn"));  // ค้นหาชื่ออังกฤษ
  }

  const where = {
    AND: [
      includeDeleted ? {} : { deletedAt: null },
      qq ? { OR: ors } : {},
    ],
  };

  const sortField = pickSort(sortBy, [
    "id",
    "code",
    "nameTh",
    "nameEn",
    "createdAt",
  ]);
  const orderBy = {
    [sortField]: String(sort).toLowerCase() === "desc" ? "desc" : "asc",
  };

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy,
      skip,
      take: l,
      select: {
        id: true,
        code: true,
        nameTh: true,
        nameEn: true,
        deletedAt: true,
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    items,
    meta: { page: p, pages: Math.ceil(total / l) || 1, total },
  };
}


export async function getOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("ไอดีไม่ถูกต้อง");
  return prisma.organization.findUnique({
    where: { id: oid },
    select: { id: true, code: true, nameTh: true, nameEn: true, deletedAt: true },
  });
}

export async function createOrganizationService({ data }) {
  const { code, nameTh, nameEn } = data || {};
  const codeStr = String(code ?? "").trim();
  if (codeStr !== "") {
    const exists = await prisma.organization.findFirst({ where: { code: codeStr } });
    if (exists) {
      const err = new Error("มีรหัสที่ตั้งนี้ในระบบแล้ว");
      err.status = 409;
      throw err;
    }
  }
  return prisma.organization.create({
    data: {
      // ไม่ส่ง/ว่าง → undefined (ไม่เขียนทับ), มีค่า → string ที่ trim แล้ว
      code: codeStr === "" ? undefined : codeStr,
      nameTh: typeof nameTh === "undefined" || nameTh === "" ? null : nameTh,
      nameEn: typeof nameEn === "undefined" || nameEn === "" ? null : nameEn,
    },
    select: { id: true, code: true, nameTh: true, nameEn: true, deletedAt: true },
  });
}

export async function updateOrganizationService({ id, data }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("ไอดีไม่ถูกต้อง");
  const { nameTh, nameEn } = data || {};
  const codeStr = String(data?.code ?? "").trim();

  // กันซ้ำ code กับตัวอื่น เมื่อมีส่ง code มาและไม่ใช่ค่าว่าง
   if (typeof data?.code !== "undefined" && codeStr !== "") {
    const exists = await prisma.organization.findFirst({
      where: { code: codeStr, NOT: { id: oid } },
      select: { id: true },
    });
    if (exists) {
      const err = new Error("มีรหัสที่ตั้งนี้ในระบบแล้ว");
      err.status = 409;
      throw err;
    }
  }

  return prisma.organization.update({
    where: { id: oid },
    data: {
      // ไม่ส่ง code = ไม่แก้ไข; ส่ง code ว่าง = เคลียร์เป็น null; ส่งค่าปกติ = string ที่ trim แล้ว
      code: typeof data?.code === "undefined" ? undefined : (codeStr === "" ? null : codeStr), 
      nameTh: typeof nameTh === "undefined" ? undefined : (nameTh || null),
      nameEn: typeof nameEn === "undefined" ? undefined : (nameEn || null),
    },
    select: { id: true, code: true, nameTh: true, nameEn: true, deletedAt: true },
  });
}

export async function softDeleteOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("ไอดีไม่ถูกต้อง");
  return prisma.organization.update({
    where: { id: oid },
    data: { deletedAt: new Date() },
    select: { id: true },
  });
}

export async function restoreOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("ไอดีไม่ถูกต้อง");
  return prisma.organization.update({
    where: { id: oid },
    data: { deletedAt: null },
    select: { id: true },
  });
}

export async function hardDeleteOrganizationService({ id }) {
  const oid = Number(id);
  if (!Number.isFinite(oid)) throw new Error("ไอดีไม่ถูกต้อง");
  const usersCount = await prisma.user.count({ where: { orgId: oid } });
  if (usersCount > 0) {
    const err = new Error("ที่ตั้งนี้มีผู้ใช้งานอยู่ ไม่สามารถลบได้");
    err.status = 409;
    throw err;
  }
  return prisma.organization.delete({ where: { id: oid }, select: { id: true } });
}
