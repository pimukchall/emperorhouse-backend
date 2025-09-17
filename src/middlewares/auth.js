import { prisma } from '../prisma.js';

/** ต้องล็อกอินเท่านั้น */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

/** ต้องมี role ตามที่กำหนดอย่างน้อยหนึ่ง */
export function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (!roles.includes(user.roleName)) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    next();
  };
}

/** โหลดข้อมูล user สด ๆ จาก DB (ทางเลือก ถ้าต้องการ) */
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
