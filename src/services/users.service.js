import bcrypt from "bcrypt";
import { prisma as defaultPrisma } from "../lib/prisma.js";
import { AppError } from "../utils/appError.js";
import { ilikeContains } from "../utils/query.util.js";
import {
  applyPrismaPagingSort,
  buildListResponse,
} from "../utils/pagination.js";

/* ============ include base (ดึงความสัมพันธ์หลัก) ============ */
const baseInclude = {
  role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
  organization: {
    select: { id: true, code: true, nameTh: true, nameEn: true },
  },
  primaryUserDept: {
    select: {
      id: true,
      positionLevel: true,
      positionName: true,
      department: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
      },
    },
  },
  userDepartments: {
    where: { endedAt: null, isActive: true },
    select: {
      id: true,
      positionLevel: true,
      positionName: true,
      department: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
      },
    },
  },
};

/* ========================= LIST ========================= */
export async function listUsersService(
  { page = 1, limit = 20, skip = 0, sortBy = "createdAt", sort = "desc", q = "", roleName, orgId } = {},
  { prisma = defaultPrisma } = {}
) {
  const filters = [{ deletedAt: null }];
  if (q) {
    filters.push({
      OR: [
        { email: ilikeContains(q) },
        { name: ilikeContains(q) },
        { firstNameTh: ilikeContains(q) },
        { lastNameTh: ilikeContains(q) },
        { firstNameEn: ilikeContains(q) },
        { lastNameEn: ilikeContains(q) },
      ],
    });
  }
  if (roleName) filters.push({ role: { name: roleName } });
  if (orgId) filters.push({ orgId: Number(orgId) });

  const where = filters.length ? { AND: filters } : {};

  const args = applyPrismaPagingSort(
    { where, include: baseInclude },
    { page, limit, skip, sortBy, sort },
    { sortMap: { createdAt: "createdAt", email: "email", name: "name", default: "createdAt" } }
  );

  const [rows, total] = await Promise.all([
    prisma.user.findMany(args),
    prisma.user.count({ where }),
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

/* ========================= GET ONE ========================= */
export async function getUserService({ prisma = defaultPrisma, id }) {
  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
    include: baseInclude,
  });
  if (!user) throw AppError.notFound("ไม่พบผู้ใช้งาน");
  return user;
}

/* ========================= CREATE ========================= */
export async function createUserService({ prisma = defaultPrisma, data }) {
  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  if (!email) throw AppError.badRequest("ต้องระบุอีเมล");

  const dup = await prisma.user.findFirst({ where: { email } });
  if (dup) throw AppError.conflict("อีเมลนี้ถูกใช้งานแล้ว");

  const password = String(data?.password || "").trim() || "Emp@123456";
  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      email,
      name: data?.name || "",
      passwordHash,
      role: data?.roleId
        ? { connect: { id: Number(data.roleId) } }
        : { connect: { name: "user" } },
      organization: data?.orgId
        ? { connect: { id: Number(data.orgId) } }
        : undefined,
      firstNameTh: data?.firstNameTh ?? "",
      lastNameTh: data?.lastNameTh ?? "",
      firstNameEn: data?.firstNameEn ?? "",
      lastNameEn: data?.lastNameEn ?? "",
      birthDate: data?.birthDate ? new Date(data.birthDate) : null,
      gender: data?.gender ?? null,
    },
    include: baseInclude,
  });

  return created;
}

/* ========================= UPDATE ========================= */
export async function updateUserService({ prisma = defaultPrisma, id, data }) {
  const fields = [
    "name",
    "firstNameTh",
    "lastNameTh",
    "firstNameEn",
    "lastNameEn",
    "employeeCode",
    "employeeType",
    "contractType",
    "avatarPath",
  ];
  const out = {};

  for (const k of fields) {
    if (data[k] !== undefined) out[k] = data[k] === "" ? null : data[k];
  }
  if (data.birthDate !== undefined)
    out.birthDate = data.birthDate ? new Date(data.birthDate) : null;
  if (data.gender !== undefined) out.gender = data.gender ?? null;

  if (data.roleId !== undefined) {
    out.role = data.roleId
      ? { connect: { id: Number(data.roleId) } }
      : undefined;
  }
  if (data.orgId !== undefined) {
    const orgId = Number(data.orgId);
    if (!orgId || data.orgId === 0 || data.orgId === "0") {
      out.organization = { disconnect: true };
    } else {
      out.organization = { connect: { id: orgId } };
    }
  }

  const updated = await prisma.user.update({
    where: { id: Number(id) },
    data: out,
    include: baseInclude,
  });

  return updated;
}

/* ========================= SOFT DELETE & RESTORE ========================= */
export async function softDeleteUserService({
  prisma = defaultPrisma,
  id,
  hard = false,
}) {
  if (hard) {
    await prisma.userDepartment
      .deleteMany({ where: { userId: Number(id) } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: Number(id) } });
    return { ok: true };
  }
  const rec = await prisma.user.update({
    where: { id: Number(id) },
    data: { deletedAt: new Date() },
    include: baseInclude,
  });
  return rec;
}

export async function restoreUserService({ prisma = defaultPrisma, id }) {
  return prisma.user.update({
    where: { id: Number(id) },
    data: { deletedAt: null },
    include: baseInclude,
  });
}

/* ========================= SET PRIMARY DEPARTMENT ========================= */
export async function setPrimaryDepartmentService({
  prisma = defaultPrisma,
  userId,
  departmentId,
}) {
  const uid = Number(userId);
  const did = Number(departmentId);
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw AppError.notFound("ไม่พบผู้ใช้งาน");

  let ud = await prisma.userDepartment.findFirst({
    where: { userId: uid, departmentId: did, endedAt: null, isActive: true },
    select: { id: true },
  });

  if (!ud) {
    ud = await prisma.userDepartment.create({
      data: {
        userId: uid,
        departmentId: did,
        positionLevel: "STAF",
        positionName: null,
        startedAt: new Date(),
        endedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
  }

  await prisma.user.update({
    where: { id: uid },
    data: { primaryUserDeptId: ud.id },
  });
  return prisma.user.findUnique({ where: { id: uid }, include: baseInclude });
}

/* ========================= SELF UPDATE PROFILE ========================= */
export async function selfUpdateProfileService({
  prisma = defaultPrisma,
  userId,
  data,
}) {
  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user) throw AppError.notFound("ไม่พบผู้ใช้งาน");

  const allowed = [
    "name",
    "firstNameTh",
    "lastNameTh",
    "firstNameEn",
    "lastNameEn",
    "birthDate",
    "gender",
    "avatarPath",
    "signature",
  ];
  const out = { updatedAt: new Date() };
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === "birthDate")
        out[key] = data[key] ? new Date(data[key]) : null;
      else if (key === "avatarPath")
        out[key] = data[key] === "" ? null : data[key];
      else out[key] = data[key];
    }
  }

  await prisma.user.update({ where: { id: Number(userId) }, data: out });
  return { ok: true };
}
