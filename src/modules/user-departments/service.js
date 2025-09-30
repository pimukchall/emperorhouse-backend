import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";

const LEVELS = ["STAF", "SVR", "ASST", "MANAGER", "MD"];

function normalizeLevel(v) {
  const up = String(v || "").toUpperCase();
  if (!LEVELS.includes(up)) throw AppError.badRequest("ตำแหน่งไม่ถูกต้อง");
  return up;
}

async function assertNoOtherActiveMD({
  prisma,
  departmentId,
  exceptUserId = null,
}) {
  const existed = await prisma.userDepartment.findFirst({
    where: {
      departmentId: Number(departmentId),
      endedAt: null,
      isActive: true,
      positionLevel: "MD",
      ...(exceptUserId ? { userId: { not: Number(exceptUserId) } } : {}),
    },
    select: { id: true, userId: true },
  });
  if (existed) throw AppError.conflict("ในแผนกนี้มี MD ที่ยัง active อยู่แล้ว");
}

async function getUdWithJoins(prisma, udId) {
  const rec = await prisma.userDepartment.findUnique({
    where: { id: Number(udId) },
    include: {
      user: {
        select: { id: true, name: true, firstNameTh: true, lastNameTh: true },
      },
      department: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
      },
    },
  });
  if (!rec) throw AppError.notFound("ไม่พบข้อมูล assignment ที่ระบุ");
  return rec;
}

/** ผูกผู้ใช้เข้ากับแผนก (หรือย้าย level/name) */
export async function assignUserToDepartmentService({
  prisma = defaultPrisma,
  userId,
  departmentId,
  positionLevel,
  positionName,
  startedAt,
}) {
  const uid = Number(userId);
  const did = Number(departmentId);
  if (!uid || !did) throw AppError.badRequest("userId/departmentId ไม่ถูกต้อง");
  const level = normalizeLevel(positionLevel);
  const now = new Date();

  if (level === "MD") {
    await assertNoOtherActiveMD({ prisma, departmentId: did });
  }

  const ud = await prisma.$transaction(async (tx) => {
    // ปิดระเบียนเดิม (ถ้ามี)
    await tx.userDepartment.updateMany({
      where: { userId: uid, departmentId: did, endedAt: null, isActive: true },
      data: { isActive: false, endedAt: now },
    });

    // สร้างระเบียนใหม่
    const created = await tx.userDepartment.create({
      data: {
        userId: uid,
        departmentId: did,
        positionLevel: level,
        positionName: positionName || null,
        startedAt: startedAt ? new Date(startedAt) : now,
        endedAt: null,
        isActive: true,
      },
      include: { department: true },
    });

    // ตั้งเป็น primary ถ้ายังไม่มี
    const owner = await tx.user.findUnique({
      where: { id: uid },
      select: { id: true, primaryUserDeptId: true },
    });
    if (owner && !owner.primaryUserDeptId) {
      await tx.user.update({
        where: { id: uid },
        data: { primaryUserDeptId: created.id },
      });
    }

    return created;
  });

  return ud;
}

/** เปลี่ยนระดับตำแหน่ง + ลง log */
export async function changeLevelService({
  prisma = defaultPrisma,
  udId,
  newLevel,
  actorId = null,
  effectiveDate = new Date(),
  reason = null,
  newPositionName,
}) {
  const tx = prisma;
  const ud = await getUdWithJoins(tx, udId);
  const toLevel = normalizeLevel(newLevel);

  if (toLevel === "MD") {
    await assertNoOtherActiveMD({
      prisma: tx,
      departmentId: ud.departmentId,
      exceptUserId: ud.userId,
    });
  }

  const updated = await tx.$transaction(async (trx) => {
    const rec = await trx.userDepartment.update({
      where: { id: ud.id },
      data: {
        positionLevel: toLevel,
        ...(newPositionName !== undefined
          ? { positionName: newPositionName || null }
          : {}),
      },
      include: { department: true },
    });

    await trx.positionChangeLog.create({
      data: {
        kind: "PROMOTE", // default; จะ map จาก rank ก็ได้ถ้าต้องการ
        userId: ud.userId,
        actorId: actorId ? Number(actorId) : null,
        fromDepartmentId: ud.departmentId,
        toDepartmentId: ud.departmentId,
        fromLevel: ud.positionLevel,
        toLevel,
        fromName: ud.positionName || null,
        toName:
          newPositionName !== undefined
            ? newPositionName || null
            : ud.positionName || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        reason: reason || null,
      },
    });

    return rec;
  });

  return updated;
}

/** เปลี่ยนชื่อ/ยุติความสัมพันธ์ (end) */
export async function endOrRenameAssignmentService({
  prisma = defaultPrisma,
  udId,
  positionName, // optional
  endedAt, // optional
}) {
  const tx = prisma;
  const now = new Date();
  const data = {};
  if (positionName !== undefined) data.positionName = positionName || null;
  if (endedAt !== undefined) {
    const ended = endedAt ? new Date(endedAt) : now;
    data.endedAt = ended;
    data.isActive = false;
  }

  const updated = await tx.userDepartment.update({
    where: { id: Number(udId) },
    data,
    include: { department: true },
  });

  if (updated.endedAt) {
    const owner = await tx.user.findFirst({
      where: { primaryUserDeptId: updated.id },
      select: { id: true },
    });
    if (owner) {
      await tx.user.update({
        where: { id: owner.id },
        data: { primaryUserDeptId: null },
      });
    }
  }

  return updated;
}

/** ดึง assignments ของผู้ใช้ */
export async function listAssignmentsByUser({
  prisma = defaultPrisma,
  userId,
  activeOnly = false,
}) {
  const where = { userId: Number(userId) };
  if (activeOnly) Object.assign(where, { endedAt: null, isActive: true });

  return prisma.userDepartment.findMany({
    where,
    orderBy: [{ endedAt: "asc" }, { startedAt: "desc" }],
    include: {
      department: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
      },
    },
  });
}

export async function listAssignmentsService(opts) {
  return listAssignmentsByUser(opts);
}

/** ตั้ง assignment เป็น primary ของผู้ใช้ (ต้องเป็น active) */
export async function setPrimaryAssignmentService({
  prisma = defaultPrisma,
  userId,
  udId,
}) {
  const tx = prisma;
  const uid = Number(userId);
  const rec = await tx.userDepartment.findFirst({
    where: { id: Number(udId), userId: uid, endedAt: null, isActive: true },
    select: { id: true },
  });
  if (!rec)
    throw AppError.badRequest(
      "ต้องเป็น assignment ที่ active ของผู้ใช้เท่านั้น"
    );
  await tx.user.update({
    where: { id: uid },
    data: { primaryUserDeptId: rec.id },
  });
  return { ok: true };
}
