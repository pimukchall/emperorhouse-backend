import { prisma } from '../prisma.js';

/** ต้องล็อกอินเท่านั้น */
export function requireAuth(req, res, next) {
  if (req.session?.user?.id) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function matchRole(user, expected) {
  const rn = String(user?.roleName || "").toLowerCase();
  return new RegExp(`^${String(expected)}$`, "i").test(rn);
}

/** ต้องมี role ตามที่กำหนดอย่างน้อยหนึ่ง (case-insensitive) */
export function requireRole(...roles) {
  return (req, res, next) => {
    const u = req.session?.user;
    if (!u?.id) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const ok = (roles || []).some((r) => matchRole(u, r));
    if (!ok) return res.status(403).json({ ok: false, error: 'Forbidden (role)' });
    next();
  };
}

function matchDept(user, val) {
  if (!user?.departmentId && !user?.deptCode) return false;
  if (typeof val === "number") return Number(user.departmentId) === Number(val);
  if (typeof val === "string") return String(user.deptCode || "").toLowerCase() === val.toLowerCase();
  return false;
}

/** ต้องอยู่ใน department ใดๆ ตามที่กำหนด */
export function requireDepartment(...codesOrIds) {
  return (req, res, next) => {
    const u = req.session?.user;
    if (!u?.id) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const ok = (codesOrIds || []).some((v) => matchDept(u, v));
    if (!ok) return res.status(403).json({ ok: false, error: 'Forbidden (department)' });
    next();
  };
}

/** ผ่านถ้ามี role ตรงหรืออยู่ใน department ที่กำหนดอย่างใดอย่างหนึ่ง */
export function requireRoleOrDepartment(roleNames = [], deptCodesOrIds = []) {
  return (req, res, next) => {
    const u = req.session?.user;
    if (!u?.id) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const okRole = (roleNames || []).some((r) => matchRole(u, r));
    const okDept = (deptCodesOrIds || []).some((d) => matchDept(u, d));
    if (!okRole && !okDept) {
      return res.status(403).json({ ok: false, error: 'Forbidden (role/department)' });
    }
    next();
  };
}

/** โหลดข้อมูล user สด ๆ จาก DB (ถ้าต้องการประกอบ response ต่อ) */
export async function hydrateMe(req, _res, next) {
  const sessionUser = req.session?.user;
  if (!sessionUser) return next();
  const fresh = await prisma.user.findFirst({
    where: { id: sessionUser.id, deletedAt: null },
    include: { role: true, department: true }
  });
  if (fresh) {
    req.me = {
      id: fresh.id,
      email: fresh.email,
      nameTh: `${fresh.firstNameTh} ${fresh.lastNameTh}`.trim(),
      nameEn: `${fresh.firstNameEn} ${fresh.lastNameEn}`.trim(),
      roleName: fresh.role?.name,
      deptCode: fresh.department?.code
    };
  }
  next();
}
