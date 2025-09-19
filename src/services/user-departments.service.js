import { canSetLevel, ensureQmrInQms, noAnotherMDinDepartment } from "../utils/roles.js";

export async function listAssignmentsService({ prisma, userId }) {
  const items = await prisma.userDepartment.findMany({
    where: { userId },
    orderBy: [{ endedAt: "asc" }, { startedAt: "desc" }],
    include: { department: true },
  });
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { primaryUserDeptId: true } });
  return items.map(x => ({ ...x, isPrimary: x.id === u?.primaryUserDeptId }));
}

export async function addOrUpdateAssignmentService({ prisma, actor, userId, departmentId, positionLevel, positionName, startedAt, setPrimary }) {
  const dept = await prisma.department.findUnique({ where: { id: Number(departmentId) } });
  if (!dept) throw new Error("INVALID_DEPT");

  if ((positionName || "").trim().toUpperCase() === "QMR" && !ensureQmrInQms(dept)) throw new Error("QMR_QMS");
  if (String(positionLevel).toUpperCase() === "MD") {
    const ok = await noAnotherMDinDepartment(prisma, departmentId);
    if (!ok) throw new Error("MD_EXISTS");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const dup = await tx.userDepartment.findFirst({ where: { userId, departmentId: Number(departmentId), endedAt: null } });
    let rec;
    if (dup) {
      rec = await tx.userDepartment.update({
        where: { id: dup.id },
        data: { positionLevel: String(positionLevel).toUpperCase(), positionName: positionName || null },
        include: { department: true },
      });
    } else {
      rec = await tx.userDepartment.create({
        data: {
          userId, departmentId: Number(departmentId),
          positionLevel: String(positionLevel).toUpperCase(),
          positionName: positionName || null,
          startedAt: startedAt ? new Date(startedAt) : now,
        },
        include: { department: true },
      });
    }
    if (setPrimary) await tx.user.update({ where: { id: userId }, data: { primaryUserDeptId: rec.id } });
    return rec;
  });
}

export async function endOrRenameAssignmentService({ prisma, udId, positionName, endedAt }) {
  const data = {};
  if (positionName !== undefined) data.positionName = positionName || null;
  if (endedAt !== undefined) data.endedAt = endedAt ? new Date(endedAt) : null;

  const updated = await prisma.userDepartment.update({ where: { id: udId }, data, include: { department: true } });
  if (updated.endedAt) {
    const owner = await prisma.user.findFirst({ where: { primaryUserDeptId: udId }, select: { id: true } });
    if (owner) await prisma.user.update({ where: { id: owner.id }, data: { primaryUserDeptId: null } });
  }
  return updated;
}

export async function changeLevelService({ prisma, actor, userId, udId, toLevel, positionName, reason, kind }) {
  if (!toLevel) throw new Error("MISSING_TOLEVEL");
  const ud = await prisma.userDepartment.findUnique({ where: { id: udId }, include: { department: true } });
  if (!ud || ud.userId !== userId) throw new Error("NOT_FOUND");
  if (ud.endedAt) throw new Error("ENDED");

  if (!canSetLevel(actor, toLevel)) throw new Error("FORBIDDEN");
  if ((positionName || "").trim().toUpperCase() === "QMR" && !ensureQmrInQms(ud.department)) throw new Error("QMR_QMS");
  if (String(toLevel).toUpperCase() === "MD") {
    const ok = await noAnotherMDinDepartment(prisma, ud.departmentId, ud.id);
    if (!ok) throw new Error("MD_EXISTS");
  }

  return prisma.$transaction(async (tx) => {
    const after = await tx.userDepartment.update({
      where: { id: udId },
      data: { positionLevel: String(toLevel).toUpperCase(), positionName: positionName ?? ud.positionName },
    });

    await tx.positionChangeLog.create({
      data: {
        kind, userId,
        fromDepartmentId: ud.departmentId,
        toDepartmentId: ud.departmentId,
        fromLevel: ud.positionLevel,
        toLevel: String(toLevel).toUpperCase(),
        fromName: ud.positionName,
        toName: positionName ?? ud.positionName,
        effectiveDate: new Date(),
        reason: reason || null,
        actorId: actor?.id || null,
      },
    });

    return after;
  });
}
