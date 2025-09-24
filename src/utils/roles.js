export const PositionLevels = ["STAF", "SVR", "ASST", "MANAGER", "MD"];
export const levelRank = Object.fromEntries(PositionLevels.map((lv, i) => [lv, i]));
export const SPECIAL = { QMR_DEPT_CODE: "QMS" };

export function isAdmin(me)   { return (me?.roleName || "").toLowerCase() === "admin"; }
export function isMD(me)      { return (me?.roleName || "").toLowerCase() === "md"; }       // เผื่ออนาคต
export function isManager(me) { return (me?.roleName || "").toLowerCase() === "manager"; }  // เผื่ออนาคต

export function canSetLevel(actor, toLevel) {
  const lv = String(toLevel || "").toUpperCase();
  if (!levelRank.hasOwnProperty(lv)) return false;
  if (isAdmin(actor)) return true;
  if (isMD(actor)) return levelRank[lv] <= levelRank["MD"];
  if (isManager(actor)) return levelRank[lv] <= levelRank["MANAGER"];
  return levelRank[lv] <= levelRank["ASST"];
}

export function ensureQmrInQms(dept) {
  return String(dept?.code || "").toUpperCase() === SPECIAL.QMR_DEPT_CODE;
}

export async function noAnotherMDinDepartment(prisma, departmentId, excludeUdId = null) {
  const dup = await prisma.userDepartment.findFirst({
    where: {
      departmentId: Number(departmentId),
      endedAt: null, isActive: true,
      positionLevel: "MD",
      ...(excludeUdId ? { NOT: { id: Number(excludeUdId) } } : {}),
    },
    select: { id: true },
  });
  return !dup;
}
