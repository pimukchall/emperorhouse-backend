import { prisma } from "../lib/prisma.js";
import { LevelRankMap } from "#utils/roles.js";

// ===== Config =====
const MGT_CODE = "MGT"; // MD ต้องสังกัดแผนกนี้เท่านั้น

// ===== Helpers: request identity =====
function getMeId(req) {
  return Number(req?.me?.id || req?.user?.id || req?.userId || req?.auth?.sub);
}
function isAdminReq(req) {
  const role =
    (req?.me?.roleName ??
      req?.user?.role ??
      req?.user?.roleName ??
      req?.auth?.role ??
      ""
    ).toString().toLowerCase();
  return role === "admin";
}

// ===== Helpers: memberships & primary dept =====
async function getActiveMemberships(userId) {
  const rows = await prisma.userDepartment.findMany({
    where: { userId: Number(userId), isActive: true, endedAt: null },
    select: {
      positionLevel: true,
      department: { select: { id: true, code: true } },
    },
  });
  return rows.map((r) => ({
    deptId: r.department?.id ?? null,
    code: String(r.department?.code || "").toUpperCase(),
    level: String(r.positionLevel || "").toUpperCase(),
    rank: LevelRankMap[String(r.positionLevel || "").toUpperCase()] ?? 0,
  }));
}

async function getPrimaryDept(userId) {
  const u = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: {
      primaryUserDept: {
        select: { departmentId: true, department: { select: { code: true } } },
      },
    },
  });
  const dep = u?.primaryUserDept;
  if (!dep) return { deptId: null, code: null };
  return {
    deptId: dep.departmentId,
    code: String(dep.department?.code || "").toUpperCase(),
  };
}

async function isMDInMGT(req) {
  const meId = getMeId(req);
  if (!meId) return false;
  const memberships = await getActiveMemberships(meId);
  return memberships.some(
    (m) => m.rank === LevelRankMap.MD && m.code === MGT_CODE
  );
}

async function isManagerSameDept(req, targetDeptIdOrCode) {
  const meId = getMeId(req);
  if (!meId) return false;
  const memberships = await getActiveMemberships(meId);
  const want =
    typeof targetDeptIdOrCode === "number"
      ? (m) => m.deptId === Number(targetDeptIdOrCode)
      : (m) => m.code === String(targetDeptIdOrCode || "").toUpperCase();

  // Manager (>= MANAGER) แต่ไม่นับ MD (เพราะ MD มีกติกาพิเศษ)
  return memberships.some(
    (m) =>
      m.rank >= LevelRankMap.MANAGER &&
      m.rank < LevelRankMap.MD &&
      want(m)
  );
}

// ===== Combiner: anyOf([...guards]) =====
// หมายเหตุ: guards **ต้อง** เรียก next() เมื่อผ่าน และ next("route-block") เมื่อไม่ผ่าน
export function anyOf(...guards) {
  return async (req, res, next) => {
    for (const g of guards) {
      let passed = false;
      try {
        await new Promise((resolve, reject) =>
          g(req, res, (err) => (err ? reject(err) : resolve()))
        );
        passed = true; // guard เรียก next() โดยไม่มี error
      } catch {
        passed = false; // guard เรียก next("route-block")
      }
      if (passed) return next();
    }
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  };
}

// ===== Generic guards =====

// admin ผ่านทุกอย่าง
export function allowAdmin(req, _res, next) {
  return isAdminReq(req) ? next() : next("route-block");
}

// MD (MGT) สำหรับสิทธิ "approve เท่านั้น" (อ่าน/อนุมัติ)
// ห้ามใช้ guard นี้กับ endpoint ที่เป็น write/delete
export async function allowMDApproveOnly(req, _res, next) {
  if (isAdminReq(req)) return next();
  if (await isMDInMGT(req)) return next();
  return next("route-block");
}

// อนุญาตแก้ไขเฉพาะ "ตัวเอง"
// resolveTargetUserId: (req) => userId เป้าหมาย (default มาจาก :id)
export function allowWriteSelfOnly(
  resolveTargetUserId = (req) => Number(req.params.id)
) {
  return async (req, _res, next) => {
    if (isAdminReq(req)) return next();
    // MD: ห้ามแก้/ลบ
    if (await isMDInMGT(req)) return next("route-block");

    const meId = getMeId(req);
    const targetId = Number(resolveTargetUserId(req));
    if (!meId || !targetId) return next("route-block");
    return meId === targetId ? next() : next("route-block");
  };
}

// ===== Module-specific guards =====

// Users: write ได้เมื่อเป็น admin, owner (แก้ตัวเอง), หรือ manager "แผนกเดียวกับผู้ใช้เป้าหมาย"
// MD (MGT) ห้าม write
export function canWriteUser() {
  return async (req, _res, next) => {
    if (isAdminReq(req)) return next();
    if (await isMDInMGT(req)) return next("route-block");

    const meId = getMeId(req);
    const targetUserId = Number(req.params.id || req.body?.userId);
    if (!meId || !targetUserId) return next("route-block");

    if (meId === targetUserId) return next(); // owner

    const targetDept = await getPrimaryDept(targetUserId);
    if (targetDept.deptId && (await isManagerSameDept(req, targetDept.deptId)))
      return next();

    return next("route-block");
  };
}

// User-Departments: write ได้เมื่อเป็น admin หรือ manager ของ "แผนกเป้าหมาย"
// departmentId: จาก body หรือเดาจาก :udId
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

// Evaluations: write/submit/delete ได้เมื่อเป็น admin, owner, หรือ manager แผนกเดียวกับ owner
// MD (MGT) ห้าม write
export function canWriteEval(
  resolveOwnerId = async (req) => {
    if (req.params?.id) {
      const ev = await prisma.evaluation.findUnique({
        where: { id: Number(req.params.id) },
        select: { ownerId: true },
      });
      return ev?.ownerId ?? null;
    }
    // create: body.ownerId || me
    return Number(req.body?.ownerId || getMeId(req));
  }
) {
  return async (req, _res, next) => {
    if (isAdminReq(req)) return next();
    if (await isMDInMGT(req)) return next("route-block");

    const meId = getMeId(req);
    const ownerId = await resolveOwnerId(req);
    if (!ownerId) return next("route-block");

    if (meId === ownerId) return next(); // owner

    const ownerDept = await getPrimaryDept(ownerId);
    if (ownerDept.deptId && (await isManagerSameDept(req, ownerDept.deptId)))
      return next();

    return next("route-block");
  };
}
