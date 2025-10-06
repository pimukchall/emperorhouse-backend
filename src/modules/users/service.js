import bcrypt from "bcrypt";
import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";
import { ilikeContains } from "#utils/query.util.js";
import { applyPrismaPagingSort } from "#utils/pagination.js";

/* include พื้นฐาน */
const baseInclude = {
  role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
  organization: { select: { id: true, code: true, nameTh: true, nameEn: true } },
  primaryUserDept: {
    select: {
      id: true, positionLevel: true, positionName: true,
      department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
    },
  },
  userDepartments: {
    where: { isActive: true },
    select: {
      id: true, positionLevel: true, positionName: true,
      department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
    },
  },
};

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

/* =============== LIST =============== */
export async function listUsersService(
  {
    page = 1,
    limit = 20,
    skip = 0,
    sortBy = "createdAt",
    sort = "desc",
    q = "",
    includeDeleted = false,
    roleId,
    orgId,
    departmentId,
  } = {},
  { prisma = defaultPrisma } = {}
) {
  const filters = [];
  if (!includeDeleted) filters.push({ deletedAt: null });
  if (q) {
    filters.push({
      OR: [
        { username: ilikeContains(q) },
        { email: ilikeContains(q) },
        { name: ilikeContains(q) },
        { firstNameTh: ilikeContains(q) },
        { lastNameTh: ilikeContains(q) },
        { firstNameEn: ilikeContains(q) },
        { lastNameEn: ilikeContains(q) },
      ],
    });
  }
  if (roleId) filters.push({ roleId: Number(roleId) });
  if (orgId) filters.push({ orgId: Number(orgId) });
  if (departmentId) {
    filters.push({
      userDepartments: {
        some: { departmentId: Number(departmentId), isActive: true },
      },
    });
  }

  const where = filters.length ? { AND: filters } : {};
  const args = applyPrismaPagingSort(
    { where, include: baseInclude },
    { page, limit, skip, sortBy, sort },
    { sortMap: { createdAt: "createdAt", username: "username", email: "email", name: "name", default: "createdAt" } }
  );

  const [rows, total] = await Promise.all([
    prisma.user.findMany(args),
    prisma.user.count({ where }),
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

/* =============== GET ONE =============== */
export async function getUserService({ prisma = defaultPrisma, id }) {
  const uid = Number(id);
  if (!Number.isFinite(uid)) throw AppError.badRequest("id ไม่ถูกต้อง");
  const user = await prisma.user.findUnique({ where: { id: uid }, include: baseInclude });
  if (!user) throw AppError.notFound("ไม่พบผู้ใช้งาน");
  return user;
}

/* =============== CREATE =============== */
export async function createUserService({ prisma = defaultPrisma, data }) {
  const username = String(data?.username || "").trim().toLowerCase();
  if (!username) throw AppError.badRequest("ต้องระบุ username");
  const email = data?.email ? String(data.email).trim().toLowerCase() : null;

  // กันซ้ำแบบ soft-unique
  const dupUsername = await prisma.user.findFirst({ where: { username, deletedAt: null }, select: { id: true } });
  if (dupUsername) throw AppError.conflict("username นี้ถูกใช้งานแล้ว");
  if (email) {
    const dupEmail = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
    if (dupEmail) throw AppError.conflict("อีเมลนี้ถูกใช้งานแล้ว");
  }

  const password = String(data?.password || "").trim();
  if (!password || password.length < 8) {
    throw AppError.badRequest("ต้องระบุรหัสผ่านอย่างน้อย 8 ตัวอักษร");
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  return prisma.user.create({
    data: {
      username,
      email,
      name: data?.name || "",
      passwordHash,
      role: data?.roleId ? { connect: { id: Number(data.roleId) } } : { connect: { name: "user" } },
      organization: data?.orgId ? { connect: { id: Number(data.orgId) } } : undefined,
      firstNameTh: data?.firstNameTh ?? "",
      lastNameTh: data?.lastNameTh ?? "",
      firstNameEn: data?.firstNameEn ?? "",
      lastNameEn: data?.lastNameEn ?? "",
      birthDate: data?.birthDate ? new Date(data.birthDate) : null,
      gender: data?.gender ?? null,
    },
    include: baseInclude,
  });
}

/* =============== UPDATE =============== */
export async function updateUserService({ prisma = defaultPrisma, id, data }) {
  const uid = Number(id);
  if (!Number.isFinite(uid)) throw AppError.badRequest("id ไม่ถูกต้อง");

  const fields = [
    "name", "firstNameTh", "lastNameTh", "firstNameEn", "lastNameEn",
    "employeeCode", "employeeType", "contractType", "avatarPath",
  ];
  const out = {};

  for (const k of fields) {
    if (data[k] !== undefined) out[k] = data[k] === "" ? null : data[k];
  }
  if (data.birthDate !== undefined) out.birthDate = data.birthDate ? new Date(data.birthDate) : null;
  if (data.gender !== undefined) out.gender = data.gender ?? null;

  // เปลี่ยน username (ถ้าส่งมา) → กันซ้ำใน active
  if (data.username !== undefined) {
    const newU = String(data.username || "").trim().toLowerCase();
    if (!newU) throw AppError.badRequest("username ไม่ถูกต้อง");
    const dup = await prisma.user.findFirst({
      where: { username: newU, deletedAt: null, NOT: { id: uid } },
      select: { id: true },
    });
    if (dup) throw AppError.conflict("username นี้ถูกใช้งานแล้ว");
    out.username = newU;
  }

  // เปลี่ยน email (optional) → กันซ้ำเฉพาะเมื่อมีค่า
  if (data.email !== undefined) {
    const newEmail = data.email ? String(data.email).trim().toLowerCase() : null;
    if (newEmail) {
      const dup = await prisma.user.findFirst({
        where: { email: newEmail, deletedAt: null, NOT: { id: uid } },
        select: { id: true },
      });
      if (dup) throw AppError.conflict("อีเมลนี้ถูกใช้งานแล้ว");
    }
    out.email = newEmail;
  }

  // กันซ้ำ employeeCode แบบ soft-unique (ตาม schema @@unique([employeeCode, deletedAt]))
  if (data.employeeCode !== undefined) {
    const code = data.employeeCode || null;
    if (code) {
      const dup = await prisma.user.findFirst({
        where: { employeeCode: code, deletedAt: null, NOT: { id: uid } },
        select: { id: true },
      });
      if (dup) throw AppError.conflict("รหัสพนักงานนี้ถูกใช้งานแล้ว");
    }
    out.employeeCode = code;
  }

  if (data.roleId !== undefined) {
    out.role = data.roleId ? { connect: { id: Number(data.roleId) } } : undefined;
  }
  if (data.orgId !== undefined) {
    const v = data.orgId;
    if (!v || v === 0 || v === "0") out.organization = { disconnect: true };
    else out.organization = { connect: { id: Number(v) } };
  }

  return prisma.user.update({ where: { id: uid }, data: out, include: baseInclude });
}

/* =============== SOFT/HARD DELETE & RESTORE =============== */
export async function softDeleteUserService({ prisma = defaultPrisma, id, hard = false }) {
  const uid = Number(id);
  if (!Number.isFinite(uid)) throw AppError.badRequest("id ไม่ถูกต้อง");

  if (hard) {
    await prisma.userDepartment.deleteMany({ where: { userId: uid } }).catch(() => {});
    await prisma.user.delete({ where: { id: uid } });
    return { ok: true };
  }
  return prisma.user.update({
    where: { id: uid },
    data: { deletedAt: new Date() },
    include: baseInclude,
  });
}

export async function restoreUserService({ prisma = defaultPrisma, id }) {
  const uid = Number(id);
  if (!Number.isFinite(uid)) throw AppError.badRequest("id ไม่ถูกต้อง");
  return prisma.user.update({
    where: { id: uid },
    data: { deletedAt: null },
    include: baseInclude,
  });
}

/* =============== SET PRIMARY DEPARTMENT =============== */
export async function setPrimaryDepartmentService({ prisma = defaultPrisma, userId, departmentId }) {
  const uid = Number(userId);
  const did = Number(departmentId);
  if (!Number.isFinite(uid) || !Number.isFinite(did)) throw AppError.badRequest("ข้อมูลไม่ถูกต้อง");

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw AppError.notFound("ไม่พบผู้ใช้งาน");

  let ud = await prisma.userDepartment.findFirst({
    where: { userId: uid, departmentId: did, isActive: true },
    select: { id: true },
  });

  if (!ud) {
    ud = await prisma.userDepartment.create({
      data: {
        userId: uid,
        departmentId: did,
        positionLevel: "STAFF",
        positionName: null,
        startedAt: new Date(),
        endedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
  }

  await prisma.user.update({ where: { id: uid }, data: { primaryUserDeptId: ud.id } });
  return prisma.user.findUnique({ where: { id: uid }, include: baseInclude });
}

/* =============== SELF UPDATE PROFILE =============== */
export async function selfUpdateProfileService({ prisma = defaultPrisma, userId, data }) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) throw AppError.badRequest("id ไม่ถูกต้อง");

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw AppError.notFound("ไม่พบผู้ใช้งาน");

  const allowed = ["name","firstNameTh","lastNameTh","firstNameEn","lastNameEn","birthDate","gender","avatarPath","signature"];
  const out = { updatedAt: new Date() };
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === "birthDate") out[key] = data[key] ? new Date(data[key]) : null;
      else if (key === "avatarPath") out[key] = data[key] === "" ? null : data[key];
      else out[key] = data[key];
    }
  }

  await prisma.user.update({ where: { id: uid }, data: out });
  // เปลี่ยนให้คืน user object ล่าสุด (รวม relation) เพื่อ FE อัปเดต state ได้ทันที
  const updated = await prisma.user.findUnique({ where: { id: uid }, include: baseInclude });
  return updated;
}
