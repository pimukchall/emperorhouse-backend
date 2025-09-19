// ----- Roles (ระบบใหม่: 'admin' | 'user') -----
export function isAdmin(me) {
  return (me?.roleName || "").toLowerCase() === "admin";
}
export function hasRole(me, name) {
  return (me?.roleName || "").toLowerCase() === String(name).toLowerCase();
}

// ----- Position Levels (จาก primary dept): STAF, SVR, ASST, MANAGER, MD -----
const LEVEL_RANK = { STAF:0, SVR:1, ASST:2, MANAGER:3, MD:4 };
export function levelRank(me) {
  const lv = String(me?.primaryLevel || "").toUpperCase();
  return LEVEL_RANK[lv] ?? -1;
}
export function hasLevelAtLeast(me, minLevel) {
  return levelRank(me) >= (LEVEL_RANK[String(minLevel).toUpperCase()] ?? 999);
}
export function isMD(me) {
  return String(me?.primaryLevel || "").toUpperCase() === "MD";
}

// ----- Department helpers (ดูจากทุกแผนก active) -----
function deptMatchList(list, codeOrId) {
  if (!Array.isArray(list)) return false;
  if (typeof codeOrId === "number") {
    return list.some(d => Number(d.id) === Number(codeOrId));
  }
  if (typeof codeOrId === "string") {
    const t = codeOrId.toLowerCase();
    return list.some(d => String(d.code || "").toLowerCase() === t);
  }
  return false;
}

/** อยู่ใน dept ที่กำหนดหรือไม่ (ดูทุกแผนก active) */
export function inDepartmentAny(me, ...codesOrIds) {
  const list = Array.isArray(me?.departments) ? me.departments : [];
  return (codesOrIds || []).some(v => deptMatchList(list, v));
}

/** ยังคงรองรับฟังก์ชันเดิม เพื่อความเข้ากันได้ย้อนหลัง */
export function inDepartment(me, codeOrId) {
  return inDepartmentAny(me, codeOrId);
}
export function inQMS(me) {
  return inDepartmentAny(me, "QMS");
}