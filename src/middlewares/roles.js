// สิทธิ์และเครื่องมือช่วยเช็ค role / ลำดับขั้น + แผนก
export function isAdmin(me) {
  return (me?.roleName || "").toLowerCase() === "admin";
}
export function isHR(me) {
  return (me?.roleName || "").toLowerCase() === "hr";
}
export function isMD(me) {
  return (me?.roleName || "").toLowerCase() === "md";
}
export function isHead(me) {
  return (me?.roleName || "").toLowerCase() === "head";
}
export function isManager(me) {
  return (me?.roleName || "").toLowerCase() === "manager";
}

// จัดลำดับขั้น (ยืดหยุ่น: ถ้าไม่มี role ที่ว่า ให้ถือว่าต่ำกว่า)
const RANK = {
  staff: 0,
  supervisor: 1,
  lead: 2,
  head: 3,
  manager: 4,
  md: 5,
  hr: 5,
  admin: 999,
};

export function roleRank(me) {
  const r = (me?.roleName || "").toLowerCase();
  return RANK[r] ?? 0;
}

export function requireRoleAtLeast(minRoleName) {
  const minRank = RANK[(minRoleName || "").toLowerCase()] ?? 0;
  return (req, res, next) => {
    const me = req.session?.user;
    if (!me) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (roleRank(me) >= minRank) return next();
    return res.status(403).json({ ok: false, error: "Forbidden" });
  };
}

// ใช้กั้นเฉพาะ role ตรง ๆ
export function requireRole(...names) {
  const allow = new Set(names.map((n) => String(n).toLowerCase()));
  return (req, res, next) => {
    const me = req.session?.user;
    if (!me) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (allow.has((me.roleName || "").toLowerCase()) || isAdmin(me))
      return next();
    return res.status(403).json({ ok: false, error: "Forbidden" });
  };
}

// เช็คว่า me อยู่แผนกเดียวกับ deptId (HR/MD/Admin ผ่าน)
export function requireSameDepartmentOrHigher(req, res, next) {
  const me = req.session?.user;
  if (!me) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (isAdmin(me) || isHR(me) || isMD(me)) return next();
  const targetDeptId = Number(
    req.body?.deptId ?? req.query?.deptId ?? req.params?.deptId
  );
  if (!targetDeptId)
    return res.status(400).json({ ok: false, error: "deptId required" });
  if (Number(me.departmentId) === Number(targetDeptId)) return next();
  return res
    .status(403)
    .json({ ok: false, error: "Forbidden (department mismatch)" });
}
