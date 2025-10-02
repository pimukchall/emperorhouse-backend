import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";

/** จัดลำดับชั้นตำแหน่ง (ต่ำ -> สูง) */
export const LEVELS = ["STAF", "SVR", "ASST", "MANAGER", "MD"];
function levelRank(lv) {
  const i = LEVELS.indexOf(String(lv || ""));
  return i >= 0 ? i : -1;
}

/* normalize select for response */
const deptSelect = { id: true, code: true, nameTh: true, nameEn: true };
const assignmentSelect = {
  id: true,
  userId: true,
  departmentId: true,
  positionLevel: true,
  positionName: true,
  startedAt: true,
  endedAt: true,
  isActive: true,
  department: { select: deptSelect },
};

/* ---------------- List (with filters) ---------------- */
export async function listAssignmentsService({
  prisma = defaultPrisma,
  page = 1,
  limit = 20,
  q = "",
  activeOnly = false,
  departmentId,
  userId,
}) {
  const where = {
    ...(activeOnly ? { endedAt: null, isActive: true } : {}),
    ...(departmentId ? { departmentId: Number(departmentId) } : {}),
    ...(userId ? { userId: Number(userId) } : {}),
    ...(q
      ? {
          OR: [
            { positionName: { contains: q } },
            { department: { nameTh: { contains: q } } },
            { department: { nameEn: { contains: q } } },
            { department: { code: { contains: q } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.userDepartment.findMany({
      where,
      select: assignmentSelect,
      orderBy: [{ isActive: "desc" }, { startedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userDepartment.count({ where }),
  ]);

  return { items, total, page, limit };
}

/* ---------------- List by user ---------------- */
export async function listByUserService({ prisma = defaultPrisma, userId, activeOnly = false }) {
  if (!userId) throw AppError.badRequest("Missing userId");
  const where = {
    userId: Number(userId),
    ...(activeOnly ? { endedAt: null, isActive: true } : {}),
  };

  const items = await prisma.userDepartment.findMany({
    where,
    select: assignmentSelect,
    orderBy: [{ isActive: "desc" }, { startedAt: "desc" }, { id: "desc" }],
  });

  return { items };
}

/* ---------------- Assign ---------------- */
export async function assignUserToDepartmentService({ prisma = defaultPrisma, actorId, payload }) {
  const {
    userId,
    departmentId,
    positionLevel,
    positionName,
    startedAt,
    makePrimary = false,
  } = payload || {};

  if (!userId || !departmentId || !positionLevel) {
    throw AppError.badRequest("ต้องระบุ userId, departmentId และ positionLevel");
  }

  // กัน MD ซ้ำในแผนก
  if (positionLevel === "MD") {
    const mdExists = await prisma.userDepartment.findFirst({
      where: { departmentId: Number(departmentId), positionLevel: "MD", endedAt: null, isActive: true },
      select: { id: true },
    });
    if (mdExists) throw AppError.conflict("แผนกนี้มี MD อยู่แล้ว");
  }

  // ปิด assignment เดิม (user+dept เดียวกัน) ก่อน
  await prisma.userDepartment.updateMany({
    where: {
      userId: Number(userId),
      departmentId: Number(departmentId),
      endedAt: null,
      isActive: true,
    },
    data: { endedAt: new Date(), isActive: false },
  });

  // สร้างระเบียนใหม่
  const created = await prisma.userDepartment.create({
    data: {
      userId: Number(userId),
      departmentId: Number(departmentId),
      positionLevel,
      positionName: positionName || null,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      isActive: true,
    },
    select: assignmentSelect,
  });

  // ตั้ง primary ครั้งแรกอัตโนมัติ หรือถ้า makePrimary = true
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { id: true, primaryUserDeptId: true },
  });
  if (!user?.primaryUserDeptId || makePrimary) {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { primaryUserDeptId: created.id },
    });
  }

  // Log (TRANSFER)
  await prisma.positionChangeLog.create({
    data: {
      kind: "TRANSFER",
      userId: Number(userId),
      actorId: actorId ? Number(actorId) : null,
      fromDepartmentId: null,
      toDepartmentId: Number(departmentId),
      fromLevel: null,
      toLevel: positionLevel,
      fromName: null,
      toName: positionName || null,
      effectiveDate: startedAt ? new Date(startedAt) : new Date(),
      reason: "assign",
    },
  });

  return created;
}

/* ---------------- End or Rename ---------------- */
export async function endOrRenameAssignmentService({
  prisma = defaultPrisma,
  actorId,
  id,
  endedAt,
  newPositionName,
  reason,
  effectiveDate,
}) {
  const ud = await prisma.userDepartment.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      userId: true,
      departmentId: true,
      positionLevel: true,
      positionName: true,
      endedAt: true,
      isActive: true,
    },
  });
  if (!ud) throw AppError.notFound("ไม่พบ assignment");

  const data = {};
  let didEnd = false;

  if (endedAt != null) {
    data.endedAt = endedAt ? new Date(endedAt) : new Date();
    data.isActive = false;
    didEnd = true;
  }
  if (newPositionName !== undefined) {
    data.positionName = newPositionName || null;
  }

  const updated = await prisma.userDepartment.update({
    where: { id: ud.id },
    data,
    select: assignmentSelect,
  });

  // ถ้า end แล้วและเป็น primary → เคลียร์
  if (didEnd) {
    await prisma.user.updateMany({
      where: { id: ud.userId, primaryUserDeptId: ud.id },
      data: { primaryUserDeptId: null },
    });
  }

  // Log (TRANSFER)
  await prisma.positionChangeLog.create({
    data: {
      kind: "TRANSFER",
      userId: ud.userId,
      actorId: actorId ? Number(actorId) : null,
      fromDepartmentId: ud.departmentId,
      toDepartmentId: ud.departmentId,
      fromLevel: ud.positionLevel,
      toLevel: ud.positionLevel,
      fromName: ud.positionName || null,
      toName: newPositionName !== undefined ? (newPositionName || null) : (ud.positionName || null),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      reason: reason || (didEnd ? "end" : "rename"),
    },
  });

  return updated;
}

/* ---------------- Change level ---------------- */
export async function changeLevelService({
  prisma = defaultPrisma,
  actorId,
  id,
  toLevel,
  newPositionName,
  reason,
  effectiveDate,
}) {
  if (!toLevel) throw AppError.badRequest("ต้องระบุ toLevel");

  const ud = await prisma.userDepartment.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      userId: true,
      departmentId: true,
      positionLevel: true,
      positionName: true,
      endedAt: true,
      isActive: true,
    },
  });
  if (!ud) throw AppError.notFound("ไม่พบ assignment");
  if (!ud.isActive || ud.endedAt) throw AppError.badRequest("Assignment นี้สิ้นสุดแล้ว");

  // กำหนด kind จากลำดับชั้น ✅
  const fromIdx = levelRank(ud.positionLevel);
  const toIdx = levelRank(toLevel);
  if (toIdx < 0) throw AppError.badRequest("toLevel ไม่ถูกต้อง");
  const kind = toIdx > fromIdx ? "PROMOTE" : (toIdx < fromIdx ? "DEMOTE" : "TRANSFER");

  // กัน MD ซ้ำ
  if (toLevel === "MD") {
    const mdExists = await prisma.userDepartment.findFirst({
      where: {
        departmentId: ud.departmentId,
        positionLevel: "MD",
        isActive: true,
        endedAt: null,
        NOT: { id: ud.id },
      },
      select: { id: true },
    });
    if (mdExists) throw AppError.conflict("แผนกนี้มี MD อยู่แล้ว");
  }

  const updated = await prisma.$transaction(async (trx) => {
    const upd = await trx.userDepartment.update({
      where: { id: ud.id },
      data: {
        positionLevel: toLevel,
        positionName:
          newPositionName !== undefined ? (newPositionName || null) : ud.positionName || null,
      },
      select: assignmentSelect,
    });

    await trx.positionChangeLog.create({
      data: {
        kind, // ✅ PROMOTE/DEMOTE/TRANSFER
        userId: ud.userId,
        actorId: actorId ? Number(actorId) : null,
        fromDepartmentId: ud.departmentId,
        toDepartmentId: ud.departmentId,
        fromLevel: ud.positionLevel,
        toLevel,
        fromName: ud.positionName || null,
        toName:
          newPositionName !== undefined ? (newPositionName || null) : ud.positionName || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        reason: reason || "change-level",
      },
    });

    return upd;
  });

  return updated;
}

/* ---------------- Set primary ---------------- */
export async function setPrimaryAssignmentService({ prisma = defaultPrisma, actorId, id }) {
  const ud = await prisma.userDepartment.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      userId: true,
      departmentId: true,
      positionLevel: true,
      positionName: true,
      endedAt: true,
      isActive: true,
    },
  });
  if (!ud) throw AppError.notFound("ไม่พบ assignment");
  if (!ud.isActive || ud.endedAt) throw AppError.badRequest("ต้องเป็น assignment ที่ยัง active");

  await prisma.user.update({
    where: { id: ud.userId },
    data: { primaryUserDeptId: ud.id },
  });

  await prisma.positionChangeLog.create({
    data: {
      kind: "TRANSFER",
      userId: ud.userId,
      actorId: actorId ? Number(actorId) : null,
      fromDepartmentId: ud.departmentId,
      toDepartmentId: ud.departmentId,
      fromLevel: ud.positionLevel,
      toLevel: ud.positionLevel,
      fromName: ud.positionName || null,
      toName: ud.positionName || null,
      effectiveDate: new Date(),
      reason: "set-primary",
    },
  });

  const updated = await prisma.userDepartment.findUnique({
    where: { id: ud.id },
    select: assignmentSelect,
  });
  return updated;
}
