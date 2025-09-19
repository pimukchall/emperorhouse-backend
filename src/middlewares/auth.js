import jwt from "jsonwebtoken";
import { prisma } from '../prisma.js';

/** helper: verify token ด้วย secret หลายชุด (รองรับ legacy/new) */
function tryVerifyAccess(token) {
  const secrets = [
    process.env.JWT_ACCESS_SECRET,       // ใช้ใน services/auth.service.js
    process.env.ACCESS_TOKEN_SECRET,     // ใช้ใน src/auth/tokens.js
  ].filter(Boolean);

  for (const secret of secrets) {
    try { return jwt.verify(token, secret); } catch {}
  }
  return null;
}
function readBearer(req) {
  const h = req.headers?.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}

/** ต้องล็อกอิน: ยอมรับทั้ง session หรือ Bearer */
export async function requireAuth(req, res, next) {
  // 1) session ก่อน
  if (req.session?.user?.id) return next();

  // 2) ถ้าไม่มี session ลอง Bearer
  const token = readBearer(req);
  if (token) {
    const decoded = tryVerifyAccess(token);
    const uid = decoded?.sub || decoded?.uid;
    if (uid) {
      const u = await prisma.user.findFirst({
        where: { id: Number(uid), deletedAt: null },
        select: {
          id: true, email: true, name: true,
          role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        }
      });
      if (u) {
        // เติมลง session เพื่อให้ middleware อื่น ๆ ใช้ร่วมกันได้
        req.session.user = {
          id: u.id,
          email: u.email,
          name: u.name,
          roleName: u.role?.name || "user",
        };
        return next();
      }
    }
  }
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function matchRole(user, expected) {
  const rn = String(user?.roleName || "").toLowerCase();
  return rn === String(expected).toLowerCase();
}

/** ต้องมี role ตามที่กำหนดอย่างน้อยหนึ่ง (case-insensitive) */
export function requireRole(...roles) {
  return (req, res, next) => {
    const rn = String(req.session?.user?.roleName || "").toLowerCase();
    const ok = roles.some((r) => rn === String(r).toLowerCase());
    if (!ok) return res.status(403).json({ ok: false, error: 'Forbidden' });
    next();
  };
}

/** เติมข้อมูล me ล่าสุดลง req.me + sync บางคีย์เข้า session.user */
export async function requireMe(req, _res, next) {
  if (req.session?.user?.id) {
    const me = await prisma.user.findFirst({
      where: { id: req.session.user.id, deletedAt: null },
      select: {
        id: true, email: true, name: true,
        role: { select: { name: true } },
        userDepartments: {
          where: { endedAt: null },
          select: {
            positionLevel: true,
            positionName: true,
            department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
          },
        },
      },
    });
    if (me) {
      const primary = me.userDepartments?.[0];
      req.me = {
        id: me.id,
        email: me.email,
        name: me.name,
        roleName: me.role?.name || "user",
        primaryDeptId: primary?.department?.id ?? null,
        primaryDeptCode: primary?.department?.code ?? null,
        primaryLevel: primary?.positionLevel ?? null,
        primaryPosition: primary?.positionName ?? null,
        departments: (me.userDepartments || []).map(d => ({
          code: d.department?.code, nameTh: d.department?.nameTh, nameEn: d.department?.nameEn
        })),
      };
      req.session.user = {
        ...req.session.user,
        roleName: req.me.roleName,
        primaryDeptId: req.me.primaryDeptId,
        primaryDeptCode: req.me.primaryDeptCode,
        primaryLevel: req.me.primaryLevel,
        primaryPosition: req.me.primaryPosition,
        departments: req.me.departments,
      };
    }
  }
  next();
}