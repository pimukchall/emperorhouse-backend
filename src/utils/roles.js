// ----- Position Levels (single source) -----
export const PositionLevels = Object.freeze(["STAFF", "SVR", "ASST", "MANAGER", "MD"]);

// ใช้มาตรฐาน rank = 1..5 (STAFF ต่ำสุด → MD สูงสุด)
export const LevelRankMap = Object.freeze({
  STAFF: 1,
  SVR: 2,
  ASST: 3,
  MANAGER: 4,
  MD: 5,
});

// ----- Role helpers -----
export function isAdmin(me) {
  const role = String(me?.roleName ?? me?.role ?? me?.auth?.role ?? "").toLowerCase();
  return role === "admin";
}
export function hasRole(me, name) {
  return String(me?.roleName ?? me?.role ?? "").toLowerCase() === String(name).toLowerCase();
}
export function isMD(me) {
  const lv = String(me?.primaryLevel ?? me?.level ?? "").toUpperCase();
  return lv === "MD";
}

// ----- Level helpers -----
export function levelRankOf(level) {
  return LevelRankMap[String(level || "").toUpperCase()] ?? 0;
}
export function levelRank(meOrLevel) {
  if (typeof meOrLevel === "string") return levelRankOf(meOrLevel);
  const lv = String(meOrLevel?.primaryLevel ?? meOrLevel?.level ?? "").toUpperCase();
  return levelRankOf(lv);
}
export function hasLevelAtLeast(meOrLevel, minLevel) {
  return levelRank(meOrLevel) >= levelRankOf(minLevel);
}
export function compareLevel(a, b) {
  return levelRank(a) - levelRank(b);
}

// ----- Department helpers (ดูจากทุกแผนก active) -----
function deptList(me) {
  return Array.isArray(me?.departments) ? me.departments : [];
}
function deptMatch(d, codeOrId) {
  if (!d) return false;
  if (typeof codeOrId === "number") return Number(d.id) === Number(codeOrId);
  return String(d.code || "").toLowerCase() === String(codeOrId || "").toLowerCase();
}
export function inDepartmentAny(me, ...codesOrIds) {
  const list = deptList(me);
  return (codesOrIds || []).some((x) => list.some((d) => deptMatch(d, x)));
}
export function inDepartment(me, codeOrId) {
  return inDepartmentAny(me, codeOrId);
}
// still provide legacy helper for compatibility (optional)
export function inQMS(me) {
  return inDepartmentAny(me, "QMS");
}

// ----- Business helper (optional) -----
// ผู้ที่ยกระดับตำแหน่งได้: admin หรือผู้ที่มีระดับ >= MANAGER และไม่ต่ำกว่าเป้าหมาย
export function canSetLevel(actor, toLevel) {
  if (isAdmin(actor)) return true;
  return hasLevelAtLeast(actor, "MANAGER") && levelRank(actor) >= levelRankOf(toLevel);
}
