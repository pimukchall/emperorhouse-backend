import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

/* ---------------- helpers: read/verify token ---------------- */
function tryVerifyAccess(token) {
  const secrets = [
    process.env.JWT_ACCESS_SECRET,
    process.env.ACCESS_TOKEN_SECRET, // เผื่อ legacy
  ].filter(Boolean);

  for (const s of secrets) {
    try {
      return jwt.verify(token, s);
    } catch {}
  }
  return null;
}
function readBearer(req) {
  const h = req.headers?.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}
function readAccessCookie(req) {
  return (
    req.cookies?.access_token ||
    req.cookies?.accessToken ||
    req.cookies?.ACCESS_TOKEN ||
    null
  );
}

/* ---------------- identity resolver ---------------- */
function resolveIdentityFromReq(req) {
  // 1) session
  if (req.session?.user?.id) {
    return { uid: Number(req.session.user.id) || null, roleFromToken: null, payload: null };
  }
  // 2) bearer
  const bearer = readBearer(req);
  if (bearer) {
    const dec = tryVerifyAccess(bearer);
    if (dec?.sub || dec?.uid) {
      return { uid: Number(dec.sub || dec.uid) || null, roleFromToken: dec.role || null, payload: dec };
    }
  }
  // 3) cookie
  const token = readAccessCookie(req);
  if (token) {
    const dec = tryVerifyAccess(token);
    if (dec?.sub || dec?.uid) {
      return { uid: Number(dec.sub || dec.uid) || null, roleFromToken: dec.role || null, payload: dec };
    }
  }
  return { uid: null, roleFromToken: null, payload: null };
}

/* ---------------- middlewares ---------------- */
export async function requireAuth(req, res, next) {
  const { uid, roleFromToken, payload } = resolveIdentityFromReq(req);
  if (!uid) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

  // NOTE: ห้าม select user.department (ไม่มีใน schema แล้ว)
  const u = await prisma.user.findFirst({
    where: { id: Number(uid), deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
      // ใช้ primaryUserDept.department แทน
      primaryUserDept: {
        select: {
          positionLevel: true,
          positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        },
      },
    },
  });

  if (!u) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

  const roleName = roleFromToken || u.role?.name || "user";
  const primaryDept = u.primaryUserDept?.department || null;

  // context แบบใหม่
  req.user = { id: u.id, role: roleName };
  req.userId = u.id;
  req.auth = payload || { sub: u.id, role: roleName };

  // sync snapshot ให้โค้ดเดิมที่อ่าน session
  req.session.user = {
    id: u.id,
    email: u.email,
    name: u.name,
    roleName,
    // map department เก่าจาก primary dept ใหม่ (ถ้าอยากให้โค้ดเก่ายังใช้ได้)
    department: primaryDept
      ? {
          id: primaryDept.id,
          code: primaryDept.code,
          nameTh: primaryDept.nameTh,
          nameEn: primaryDept.nameEn,
        }
      : undefined,
    primaryDeptId: primaryDept?.id ?? null,
    primaryDeptCode: primaryDept?.code ?? null,
    primaryLevel: u.primaryUserDept?.positionLevel ?? null,
    primaryPosition: u.primaryUserDept?.positionName ?? null,
  };

  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const got = String(
      req.user?.role || req.auth?.role || req.session?.user?.roleName || ""
    ).toLowerCase();
    const ok = roles.some((r) => got === String(r || "").toLowerCase());
    if (!ok) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    next();
  };
}

export async function requireMe(req, _res, next) {
  const uid =
    req.session?.user?.id ||
    req.user?.id ||
    req.userId ||
    req.auth?.sub ||
    null;

  if (uid) {
    const me = await prisma.user.findFirst({
      where: { id: Number(uid), deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: { select: { name: true } },
        userDepartments: {
          where: { endedAt: null },
          select: {
            positionLevel: true,
            positionName: true,
            department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
          },
        },
        primaryUserDept: {
          select: {
            positionLevel: true,
            positionName: true,
            department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
          },
        },
      },
    });

    if (me) {
      const primary = me.primaryUserDept || me.userDepartments?.[0] || null;
      req.me = {
        id: me.id,
        email: me.email,
        name: me.name,
        roleName: me.role?.name || "user",
        primaryDeptId: primary?.department?.id ?? null,
        primaryDeptCode: primary?.department?.code ?? null,
        primaryLevel: primary?.positionLevel ?? null,
        primaryPosition: primary?.positionName ?? null,
        departments: (me.userDepartments || []).map((d) => ({
          id: d.department?.id,
          code: d.department?.code,
          nameTh: d.department?.nameTh,
          nameEn: d.department?.nameEn,
        })),
      };

      // sync ส่วนสำคัญเข้า session (เผื่อโค้ดเก่า)
      req.session.user = {
        ...(req.session.user || {}),
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
