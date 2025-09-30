import { prisma } from "#lib/prisma.js";
import { LevelRankMap } from "#utils/roles.js";

const MGT_CODE = "MGT";

/* ----------------- helpers (pure-ish) ----------------- */
function getMeId(req) {
  return Number(req?.me?.id || req?.user?.id || req?.userId || req?.auth?.sub);
}

function getRoleName(req) {
  return String(
    req?.me?.roleName ??
      req?.user?.role ??
      req?.user?.roleName ??
      req?.auth?.role ??
      ""
  ).toLowerCase();
}

function isAdminReq(req) {
  return getRoleName(req) === "admin";
}

function wantSameDept(target) {
  return typeof target === "number"
    ? (m) => m.deptId === Number(target)
    : (m) => m.code === String(target || "").toUpperCase();
}

/* ----------------- cached lookups on req ----------------- */
async function getActiveMemberships(req, userId) {
  req._policy = req._policy || {};
  const key = `active:${userId}`;
  if (req._policy[key]) return req._policy[key];

  const rows = await prisma.userDepartment.findMany({
    where: { userId: Number(userId), isActive: true, endedAt: null },
    select: {
      positionLevel: true,
      department: { select: { id: true, code: true } },
    },
  });

  const mapped = rows.map((r) => {
    const level = String(r.positionLevel || "").toUpperCase();
    return {
      deptId: r.department?.id ?? null,
      code: String(r.department?.code || "").toUpperCase(),
      level,
      rank: LevelRankMap[level] ?? 0,
    };
  });

  req._policy[key] = mapped;
  return mapped;
}

async function getPrimaryDept(req, userId) {
  req._policy = req._policy || {};

  // ถ้ามีใน req.me อยู่แล้ว ใช้ก่อน (เร็วกว่า)
  if (getMeId(req) === Number(userId) && req.me?.primaryDeptId) {
    return { deptId: req.me.primaryDeptId, code: req.me.primaryDeptCode };
  }

  const key = `primary:${userId}`;
  if (req._policy[key]) return req._policy[key];

  const u = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: {
      primaryUserDept: {
        select: { departmentId: true, department: { select: { code: true } } },
      },
    },
  });

  const dep = u?.primaryUserDept;
  const out = dep
    ? {
        deptId: dep.departmentId,
        code: String(dep.department?.code || "").toUpperCase(),
      }
    : { deptId: null, code: null };

  req._policy[key] = out;
  return out;
}

/* ----------------- composed checks ----------------- */
async function isMDInMGT(req) {
  const meId = getMeId(req);
  if (!meId) return false;
  const memberships = await getActiveMemberships(req, meId);
  return memberships.some(
    (m) => m.rank === LevelRankMap.MD && m.code === MGT_CODE
  );
}

async function isManagerSameDept(req, targetDeptIdOrCode) {
  const meId = getMeId(req);
  if (!meId) return false;
  const memberships = await getActiveMemberships(req, meId);
  const want = wantSameDept(targetDeptIdOrCode);
  return memberships.some(
    (m) => m.rank >= LevelRankMap.MANAGER && m.rank < LevelRankMap.MD && want(m)
  );
}

/* ----------------- public guards ----------------- */
export function anyOf(...guards) {
  return async (req, res, next) => {
    for (const g of guards) {
      let passed = false;
      try {
        await new Promise((resolve, reject) =>
          g(req, res, (err) => (err ? reject(err) : resolve()))
        );
        passed = true;
      } catch {
        passed = false;
      }
      if (passed) return next();
    }
    return res
      .status(403)
      .json({
        ok: false,
        error: { code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์ทำรายการนี้" },
      });
  };
}

export function allowAdmin(req, _res, next) {
  return isAdminReq(req) ? next() : next("route-block");
}

export async function allowMDApproveOnly(req, _res, next) {
  if (isAdminReq(req)) return next();
  if (await isMDInMGT(req)) return next();
  return next("route-block");
}

/** แก้ไข/อ่านข้อมูล “ตัวเองเท่านั้น” (admin ผ่าน, MD@MGT ถูก block) */
export function allowWriteSelfOnly(resolveTargetUserId = (req) => Number(req.params.id)) {
  return async (req, _res, next) => {
    if (isAdminReq(req)) return next();
    if (await isMDInMGT(req)) return next("route-block");

    const meId = getMeId(req);
    const targetId = Number(resolveTargetUserId(req));
    if (!meId || !targetId) return next("route-block");

    return meId === targetId ? next() : next("route-block");
  };
}

/** เขียนข้อมูลผู้ใช้: owner ตัวเอง หรือ “ผู้จัดการแผนกเดียวกับเจ้าของ” (admin ผ่าน, MD@MGT ถูก block) */
export function canWriteUser() {
  return async (req, _res, next) => {
    if (isAdminReq(req)) return next();
    if (await isMDInMGT(req)) return next("route-block");

    const meId = getMeId(req);
    const targetUserId = Number(req.params.id || req.body?.userId);
    if (!meId || !targetUserId) return next("route-block");

    if (meId === targetUserId) return next();

    const targetDept = await getPrimaryDept(req, targetUserId);
    if (targetDept.deptId && (await isManagerSameDept(req, targetDept.deptId)))
      return next();

    return next("route-block");
  };
}

/** เขียนความสัมพันธ์ user-department: ต้องเป็น manager ของแผนกนั้น (admin ผ่าน, MD@MGT ถูก block) */
export function canWriteUserDepartment(
  resolveDeptId = async (req) => {
    if (req.body?.departmentId) return Number(req.body.departmentId);
    if (req.params?.udId) {
      const ud = await prisma.userDepartment.findUnique({
        where: { id: Number(req.params.udId) },
        select: { departmentId: true },
      });
      return ud?.departmentId ?? null;
    }
    return null;
  }
) {
  return async (req, _res, next) => {
    if (isAdminReq(req)) return next();
    if (await isMDInMGT(req)) return next("route-block");

    const did = await resolveDeptId(req);
    if (!did) return next("route-block");

    if (await isManagerSameDept(req, did)) return next();
    return next("route-block");
  };
}

/** เขียนใบประเมิน (eval): owner ตัวเอง หรือ manager แผนกเดียวกับ owner (admin ผ่าน, MD@MGT ถูก block) */
export function canWriteEval(
  resolveOwnerId = async (req) => {
    if (req.params?.id) {
      const ev = await prisma.evaluation.findUnique({
        where: { id: Number(req.params.id) },
        select: { ownerId: true },
      });
      return ev?.ownerId ?? null;
    }
    return Number(req.body?.ownerId || getMeId(req));
  }
) {
  return async (req, _res, next) => {
    if (isAdminReq(req)) return next();
    if (await isMDInMGT(req)) return next("route-block");

    const meId = getMeId(req);
    const ownerId = await resolveOwnerId(req);
    if (!ownerId) return next("route-block");

    if (meId === ownerId) return next();

    const ownerDept = await getPrimaryDept(req, ownerId);
    if (ownerDept.deptId && (await isManagerSameDept(req, ownerDept.deptId)))
      return next();

    return next("route-block");
  };
}