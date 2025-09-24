// src/services/user-departments.service.js
import { prisma as defaultPrisma } from "../prisma.js";

const LEVELS = ["STAF", "SVR", "ASST", "MANAGER", "MD"];

/** ปรับเป็น UPPERCASE และตรวจว่าเป็นค่า enum ที่สคีมารองรับ */
function normalizeLevel(v) {
  const up = String(v || "").toUpperCase();
  if (!LEVELS.includes(up)) {
    const err = new Error("ตำแหน่งไม่ถูกต้อง");
    err.status = 400;
    throw err;
  }
  return up;
}

/**
 * ตรวจว่ามี MD ที่ยัง active อยู่ในแผนกเดียวกัน (ยกเว้นคนเดิม) หรือไม่
 * ใช้ก่อนเปลี่ยนระดับ/สร้าง assignment ใหม่ให้เป็น MD
 */
async function assertNoOtherActiveMD({ prisma, departmentId, exceptUserId = null }) {
  const existed = await prisma.userDepartment.findFirst({
    where: {
      departmentId: Number(departmentId),
      endedAt: null, isActive: true,
      isActive: true,
      positionLevel: "MD",
      ...(exceptUserId ? { userId: { not: Number(exceptUserId) } } : {}),
    },
    select: { id: true, userId: true },
  });
  if (existed) {
    const err = new Error("ในแผนกนี้มี MD ที่ยัง active อยู่แล้ว");
    err.status = 409;
    throw err;
  }
}

/**
 * ดึง assignment + owner + department (สำหรับตรวจสอบ/เขียน log)
 */
async function getUdWithJoins(prisma, udId) {
  const rec = await prisma.userDepartment.findUnique({
    where: { id: Number(udId) },
    include: {
      user: { select: { id: true, name: true, firstNameTh: true, lastNameTh: true } },
      department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
    },
  });
  if (!rec) {
    const err = new Error("ไม่พบข้อมูล assignment ที่ระบุ");
    err.status = 404;
    throw err;
  }
  return rec;
}

/**
 * สร้าง/อัปเดต assignment สำหรับ user + department
 * - ถ้ามี active เดิมอยู่ → update (level/name/startedAt)
 * - ถ้าไม่มี → create ใหม่ (กันข้อมูลเพี้ยนด้วยการปิด active ที่อาจหลุด)
 * - ถ้า level เป็น MD → กัน MD ซ้ำในแผนก
 * - ถ้ายังไม่เคยตั้ง primary ให้ user → ตั้ง primary เป็น assignment ที่ได้
 */
export async function addOrUpdateAssignmentService({
  prisma = defaultPrisma,
  userId,
  departmentId,
  positionLevel,
  positionName,
  startedAt,
}) {
  const uid = Number(userId);
  const did = Number(departmentId);
  const now = new Date();

  const level = normalizeLevel(positionLevel);

  return prisma.$transaction(async (tx) => {
    // ถ้าตั้งเป็น MD → กัน MD ซ้ำ
    if (level === "MD") {
      await assertNoOtherActiveMD({ prisma: tx, departmentId: did, exceptUserId: uid });
    }

    // หา active assignment เดิม
    let ud = await tx.userDepartment.findFirst({
      where: { userId: uid, departmentId: did, endedAt: null, isActive: true, isActive: true },
      include: { department: true },
    });

    if (ud) {
      // update กรณีมี active เดิม
      ud = await tx.userDepartment.update({
        where: { id: ud.id },
        data: {
          positionLevel: level,
          positionName: positionName ?? ud.positionName,
          ...(startedAt !== undefined ? { startedAt: startedAt ? new Date(startedAt) : now } : {}),
          isActive: true,
          endedAt: null, isActive: true,
        },
        include: { department: true },
      });
    } else {
      // กันข้อมูลเพี้ยน: เผื่อมี active record ซ้อนหลุดมา
      await tx.userDepartment.updateMany({
        where: { userId: uid, departmentId: did, endedAt: null, isActive: true, isActive: true },
        data: { isActive: false, endedAt: now },
      });

      ud = await tx.userDepartment.create({
        data: {
          userId: uid,
          departmentId: did,
          positionLevel: level,
          positionName: positionName || null,
          startedAt: startedAt ? new Date(startedAt) : now,
          endedAt: null, isActive: true,
          isActive: true,
        },
        include: { department: true },
      });
    }

    // ถ้า user ยังไม่มี primary → ตั้งให้เลย
    const owner = await tx.user.findUnique({
      where: { id: uid },
      select: { id: true, primaryUserDeptId: true },
    });
    if (owner && !owner.primaryUserDeptId) {
      await tx.user.update({
        where: { id: uid },
        data: { primaryUserDeptId: ud.id },
      });
    }

    return ud;
  });
}

/**
 * เปลี่ยน "ระดับ" (PositionLevel) ของ assignment ที่ระบุ
 * - กัน MD ซ้ำในแผนก
 * - เขียน PositionChangeLog (from/to)
 */
export async function changeLevelService({
  prisma = defaultPrisma,
  udId,
  newLevel,
  actorId = null,
  effectiveDate = new Date(),
  reason = null,
  newPositionName, // (optional) ถ้าต้องการแก้ชื่อไปพร้อมกัน
}) {
  const tx = prisma;
  const ud = await getUdWithJoins(tx, udId);
  const toLevel = normalizeLevel(newLevel);

  // ถ้าจะเปลี่ยนเป็น MD → กัน MD ซ้ำในแผนก
  if (toLevel === "MD") {
    await assertNoOtherActiveMD({
      prisma: tx,
      departmentId: ud.departmentId,
      exceptUserId: ud.userId,
    });
  }

  const updated = await tx.$transaction(async (trx) => {
    // Update assignment
    const rec = await trx.userDepartment.update({
      where: { id: ud.id },
      data: {
        positionLevel: toLevel,
        ...(newPositionName !== undefined ? { positionName: newPositionName || null } : {}),
      },
      include: { department: true },
    });

    // Write PositionChangeLog
    await trx.positionChangeLog.create({
      data: {
        kind: "PROMOTE", // หรือจะ map จาก rank from/to ก็ได้ (ขอใช้ PROMOTE เป็น default)
        userId: ud.userId,
        actorId: actorId ? Number(actorId) : null,
        fromDepartmentId: ud.departmentId,
        toDepartmentId: ud.departmentId,
        fromLevel: ud.positionLevel,
        toLevel,
        fromName: ud.positionName || null,
        toName: newPositionName !== undefined ? (newPositionName || null) : ud.positionName || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        reason: reason || null,
      },
    });

    return rec;
  });

  return updated;
}

/**
 * แก้ชื่อ positionName / ยุติ (end) assignment
 * - ถ้า end → เซ็ต endedAt และ isActive=false
 * - ถ้า assignment ถูก end และเป็น primary ของ user → เคลียร์ primaryUserDeptId
 */
export async function endOrRenameAssignmentService({
  prisma = defaultPrisma,
  udId,
  positionName, // optional: ปรับชื่อ
  endedAt,      // optional: ถ้าตั้ง → end
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

  // ถ้า end แล้ว และเคยเป็น primary → เคลียร์
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

/**
 * ดึง assignments ของผู้ใช้
 * - activeOnly=true → endedAt=null & isActive=true
 */
export async function listAssignmentsByUser({
  prisma = defaultPrisma,
  userId,
  activeOnly = false,
}) {
  const where = { userId: Number(userId) };
  if (activeOnly) {
    Object.assign(where, { endedAt: null, isActive: true, isActive: true });
  }

  return prisma.userDepartment.findMany({
    where,
    orderBy: [{ endedAt: "asc" }, { startedAt: "desc" }],
    include: {
      department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
    },
  });
}

export async function listAssignmentsService(opts) {
  return listAssignmentsByUser(opts);
}

/**
 * ตั้ง assignment เป็น primary ของผู้ใช้ (utility เผื่อ controller เรียกตรง)
 * - ต้องเป็น active record เท่านั้น
 */
export async function setPrimaryAssignmentService({
  prisma = defaultPrisma,
  userId,
  udId,
}) {
  const tx = prisma;
  const uid = Number(userId);
  const rec = await tx.userDepartment.findFirst({
    where: { id: Number(udId), userId: uid, endedAt: null, isActive: true, isActive: true },
    select: { id: true },
  });
  if (!rec) {
    const err = new Error("ต้องเป็น assignment ที่ active ของผู้ใช้เท่านั้น");
    err.status = 400;
    throw err;
  }
  await tx.user.update({
    where: { id: uid },
    data: { primaryUserDeptId: rec.id },
  });
  return { ok: true };
}
