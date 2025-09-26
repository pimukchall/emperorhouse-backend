// ----- Role helpers -----
export function isAdmin(me) {
  return (me?.roleName || "").toLowerCase() === "admin";
}
export function hasRole(me, name) {
  return (me?.roleName || "").toLowerCase() === String(name).toLowerCase();
}

// ----- Level ranking -----
export const PositionLevels = Object.freeze([
  "STAF",
  "SVR",
  "ASST",
  "MANAGER",
  "MD",
]);
export const LevelRankMap = Object.freeze({
  STAF: 0,
  SVR: 1,
  ASST: 2,
  MANAGER: 3,
  MD: 4,
});

export function levelRank(me) {
  const lv = String(me?.primaryLevel || "").toUpperCase();
  return LevelRankMap[lv] ?? -1;
}
export function hasLevelAtLeast(me, minLevel) {
  return levelRank(me) >= (LevelRankMap[String(minLevel).toUpperCase()] ?? 999);
}
export function isMD(me) {
  return String(me?.primaryLevel || "").toUpperCase() === "MD";
}

// ----- Department helpers -----
function deptList(me) {
  return Array.isArray(me?.departments) ? me.departments : [];
}
function deptMatch(d, codeOrId) {
  if (!d) return false;
  if (typeof codeOrId === "number") return Number(d.id) === Number(codeOrId);
  const t = String(codeOrId || "").toLowerCase();
  return String(d.code || "").toLowerCase() === t;
}
export function inDepartmentAny(me, ...codesOrIds) {
  const list = deptList(me);
  return (codesOrIds || []).some((x) => list.some((d) => deptMatch(d, x)));
}
export function inDepartment(me, codeOrId) {
  return inDepartmentAny(me, codeOrId);
}

// ----- Business rules (ตัวอย่าง) -----
/** ผู้ปฏิบัติงานสามารถตั้งระดับตำแหน่งได้หรือไม่ */
export function canSetLevel(actor, toLevel) {
  if (isAdmin(actor)) return true;
  // อนุญาตเฉพาะคนที่ระดับ >= MANAGER เท่านั้นที่จะตั้งระดับคนอื่น
  return (
    hasLevelAtLeast(actor, "MANAGER") &&
    levelRank(actor) >= (LevelRankMap[String(toLevel).toUpperCase()] ?? -1)
  );
}

/** ป้องกันการมี MD ซ้ำในแผนกเดียวกัน (ต้องส่ง prisma client เข้ามาเอง) */
export async function noAnotherMDinDepartment(
  prisma,
  departmentId,
  excludeUdId = null
) {
  const count = await prisma.userDepartment.count({
    where: {
      departmentId: Number(departmentId),
      isActive: true,
      endedAt: null,
      positionLevel: "MD",
      ...(excludeUdId ? { id: { not: Number(excludeUdId) } } : {}),
    },
  });
  return count === 0;
}

/** ใครประเมินใครได้? ตัวอย่าง logic:
 * - admin ประเมินใครก็ได้
 * - ต้องอยู่แผนกเดียวกัน (อย่างน้อยหนึ่งแผนกทับซ้อน)
 * - ผู้ประเมินต้องมีระดับ "สูงกว่า" ผู้ถูกประเมิน
 */
export function canEvaluate(actor, target) {
  if (!actor || !target) return false;
  if (isAdmin(actor)) return true;

  const sameDept =
    deptList(actor).some((a) =>
      deptList(target).some(
        (t) => a.id && t.id && Number(a.id) === Number(t.id)
      )
    ) ||
    (actor.primaryDeptId &&
      target.primaryDeptId &&
      Number(actor.primaryDeptId) === Number(target.primaryDeptId));

  if (!sameDept) return false;

  return levelRank(actor) > levelRank(target);
}
