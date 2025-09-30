import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";
import { computeScores } from "#lib/score.js";

/* ------------ rank helpers ------------ */
const Rank = { STAF: 1, SVR: 2, ASST: 3, MANAGER: 4, MD: 5 };
const rank = (lv) => Rank[String(lv || "").toUpperCase()] ?? -1;

/* ------------ signature helpers ------------ */
function toBuffer(sig) {
  if (!sig) return null;
  if (Buffer.isBuffer(sig)) return sig;
  const s = String(sig);
  const b64 = s.startsWith("data:") ? s.replace(/^data:.*;base64,/, "") : s;
  try { return Buffer.from(b64, "base64"); } catch { return null; }
}
function requireSignature(sig) {
  const buf = toBuffer(sig);
  if (!buf || buf.length < 16) throw AppError.badRequest("ต้องมีลายเซ็น");
  return buf;
}

/* ------------ profiles ------------ */
async function getActiveMemberships({ prisma, userId }) {
  const rows = await prisma.userDepartment.findMany({
    where: { userId, isActive: true, endedAt: null },
    select: { departmentId: true, positionLevel: true },
  });
  return rows.map((r) => ({ deptId: r.departmentId, level: r.positionLevel }));
}

async function getPrimaryProfile({ prisma, userId }) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: { select: { name: true } },
      primaryUserDept: { select: { departmentId: true, positionLevel: true } },
    },
  });
  if (!u) throw AppError.notFound("ไม่พบข้อมูลผู้ใช้");
  const memberships = await getActiveMemberships({ prisma, userId });
  return {
    id: u.id,
    roleName: (u.role?.name ?? "").toLowerCase(),
    primaryDeptId: u.primaryUserDept?.departmentId ?? null,
    primaryLevel: u.primaryUserDept?.positionLevel ?? null,
    memberships,
  };
}

function assertProfileComplete(p, who = "บัญชีผู้ใช้") {
  const lacksRole = !p.roleName || p.roleName.trim() === "";
  const validMemberships = Array.isArray(p.memberships)
    ? p.memberships.filter((m) => m?.deptId != null && (m?.level ?? "") !== "")
    : [];
  if (lacksRole || validMemberships.length === 0) {
    throw AppError.badRequest(`${who} ยังไม่ได้ตั้งค่า role/department/positionLevel`, "PROFILE_INCOMPLETE");
  }
}

/* ------------ gates ------------ */
async function isPrivileged({ prisma, me }) {
  const role = (me?.roleName || "").toLowerCase();
  if (role === "admin" || role === "hr") return true;

  // ตรวจระดับ MD จาก membership
  const hasMDLevel = Array.isArray(me?.memberships)
    ? me.memberships.some((m) => String(m?.level || "").toUpperCase() === "MD")
    : false;

  // เผื่อ primary
  const isPrimaryMD = String(me?.primaryLevel || "").toUpperCase() === "MD";
  return hasMDLevel || isPrimaryMD;
}

export async function ensureCycleOpen(cycleId, { prisma = defaultPrisma } = {}) {
  const c = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!c) throw AppError.notFound("ไม่พบรอบการประเมิน");
  const now = new Date();
  if (!c.isActive || now < c.openAt || now > c.closeAt) {
    throw AppError.forbidden("รอบการประเมินไม่เปิดใช้งาน", "CYCLE_CLOSED");
  }
  return c;
}

export async function canEvaluate({ prisma = defaultPrisma, evaluatorId, evaluateeId }) {
  if (evaluatorId === evaluateeId) return true;
  const ev = await getPrimaryProfile({ prisma, userId: evaluatorId });
  const ee = await getPrimaryProfile({ prisma, userId: evaluateeId });
  assertProfileComplete(ev, "บัญชีผู้ประเมิน");
  // admin/hr หรือ MD สามารถประเมินได้ทุกคน
  if (await isPrivileged({ prisma, me: ev })) return true;

  const eeDept = ee.primaryDeptId;
  const eeLevel = ee.primaryLevel;
  if (eeDept == null || (eeLevel ?? "") === "") return false;

  return ev.memberships.some(
    (m) => m.deptId === eeDept && rank(m.level) > rank(eeLevel)
  );
}

/* ------------ services ------------ */
export async function createEvaluation(
  { cycleId, ownerId, managerId, mdId, type, byUserId },
  { prisma = defaultPrisma } = {}
) {
  await ensureCycleOpen(cycleId, { prisma });

  if (byUserId && byUserId !== ownerId) {
    const ok = await canEvaluate({ prisma, evaluatorId: byUserId, evaluateeId: ownerId });
    if (!ok) throw AppError.forbidden("คุณไม่มีสิทธิ์ประเมินผู้ใช้คนนี้", "FORBIDDEN_EVALUATE");
  }

  const exists = await prisma.evaluation.findUnique({
    where: { cycleId_ownerId: { cycleId, ownerId } },
  });
  if (exists) return exists;

  const cyc = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!cyc) throw AppError.notFound("ไม่พบรอบการประเมิน");

  return prisma.evaluation.create({
    data: {
      ownerId,
      createdById: byUserId ?? ownerId,
      managerId: managerId ?? null,
      mdId: mdId ?? null,
      cycleId,
      stage: cyc.stage,
      type: String(type || "OPERATIONAL").toUpperCase(),
      status: "DRAFT",
    },
  });
}

export async function getEvaluation(id, { prisma = defaultPrisma } = {}) {
  const row = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      cycle: true,
      owner: {
        select: {
          id: true,
          firstNameTh: true,
          lastNameTh: true,
          primaryUserDept: {
            select: {
              positionLevel: true,
              department: {
                select: { id: true, code: true, nameTh: true, nameEn: true },
              },
            },
          },
        },
      },
      manager: { select: { id: true, firstNameTh: true, lastNameTh: true } },
      md: { select: { id: true, firstNameTh: true, lastNameTh: true } },
    },
  });
  if (!row) throw AppError.notFound("ไม่พบแบบฟอร์มการประเมิน");
  return row;
}

export async function updateEvaluation(id, data, byUserId, { prisma = defaultPrisma } = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw AppError.notFound("ไม่พบแบบฟอร์มการประเมิน");
  if (!["DRAFT", "REJECTED"].includes(ev.status)) {
    throw AppError.conflict("ไม่สามารถแก้ไขหลังส่งแล้ว");
  }

  await ensureCycleOpen(ev.cycleId, { prisma });

  if (byUserId !== ev.ownerId) {
    const actor = await getPrimaryProfile({ prisma, userId: byUserId });
    const canOverride = ["admin", "hr"].includes(actor.roleName);
    if (!canOverride) {
      throw AppError.forbidden("เฉพาะเจ้าของ (หรือ HR/Admin) ที่สามารถแก้ไขร่างได้");
    }
  }

  return prisma.evaluation.update({ where: { id }, data });
}

export async function submitEvaluation(id, byUserId, payload = {}, { prisma = defaultPrisma } = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw AppError.notFound("ไม่พบแบบฟอร์มการประเมิน");
  if (byUserId !== ev.ownerId) throw AppError.forbidden("เฉพาะเจ้าของเท่านั้นที่สามารถส่งฟอร์มได้");

  await ensureCycleOpen(ev.cycleId, { prisma });

  const ownerProfile = await getPrimaryProfile({ prisma, userId: byUserId });
  assertProfileComplete(ownerProfile, "บัญชีผู้ยื่น");

  const submitterSignature = requireSignature(payload.signature);
  const now = new Date();
  const scores = computeScores(ev, ev.type);

  const data = {
    ...scores,
    status: "SUBMITTED",
    submittedAt: now,
    submitterSignedAt: now,
    submitterComment: payload.comment ?? null,
    submitterSignature,
    ...(ev.createdById ? {} : { createdById: byUserId }),
  };

  const isSelfMgr = ev.managerId && ev.managerId === ev.ownerId;
  const isSelfMD  = ev.mdId && ev.mdId === ev.ownerId;

  if (isSelfMgr || !ev.managerId) {
    Object.assign(data, {
      status: "APPROVER_APPROVED",
      approverAt: now,
      managerSignedAt: now,
      managerSignature: submitterSignature,
    });
  }
  if (isSelfMD || !ev.mdId) {
    Object.assign(data, {
      status: "COMPLETED",
      mdAt: now,
      completedAt: now,
      mdSignedAt: now,
      mdSignature: submitterSignature,
    });
  }

  return prisma.evaluation.update({ where: { id: ev.id }, data });
}

export async function approveByManager(id, byUserId, payload = {}, { prisma = defaultPrisma } = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw AppError.notFound("ไม่พบแบบฟอร์มการประเมิน");
  if (ev.status !== "SUBMITTED") throw AppError.conflict("ต้องส่งฟอร์มก่อนอนุมัติ");
  if (byUserId !== ev.managerId) throw AppError.forbidden("เฉพาะหัวหน้าที่ได้รับมอบหมายเท่านั้น");

  await ensureCycleOpen(ev.cycleId, { prisma });

  const sig = requireSignature(payload.signature);
  const now = new Date();
  const data = {
    status: "APPROVER_APPROVED",
    approverAt: now,
    managerComment: payload.comment ?? ev.managerComment,
    managerSignedAt: now,
    managerSignature: sig,
  };
  if ((ev.mdId && ev.mdId === byUserId) || !ev.mdId) {
    Object.assign(data, {
      status: "COMPLETED",
      mdAt: now,
      completedAt: now,
      mdSignedAt: now,
      mdSignature: sig,
    });
  }
  return prisma.evaluation.update({ where: { id: ev.id }, data });
}

export async function approveByMD(id, byUserId, payload = {}, { prisma = defaultPrisma } = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw AppError.notFound("ไม่พบแบบฟอร์มการประเมิน");
  if (ev.status !== "APPROVER_APPROVED") throw AppError.conflict("ต้องได้รับการอนุมัติจากหัวหน้าก่อน");
  if (byUserId !== ev.mdId) throw AppError.forbidden("เฉพาะ MD ที่ได้รับมอบหมายเท่านั้น");

  await ensureCycleOpen(ev.cycleId, { prisma });

  const sig = requireSignature(payload.signature);
  const now = new Date();
  return prisma.evaluation.update({
    where: { id: ev.id },
    data: {
      status: "COMPLETED",
      mdComment: payload.comment ?? ev.mdComment,
      mdSignedAt: now,
      mdSignature: sig,
      mdAt: now,
      completedAt: now,
    },
  });
}

export async function rejectEvaluation(id, byUserId, comment, { prisma = defaultPrisma } = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw AppError.notFound("ไม่พบแบบฟอร์มการประเมิน");
  if (!["SUBMITTED", "APPROVER_APPROVED"].includes(ev.status)) {
    throw AppError.conflict("ไม่สามารถปฏิเสธได้ในสถานะนี้");
  }
  if (![ev.managerId, ev.mdId].includes(byUserId)) {
    throw AppError.forbidden("เฉพาะหัวหน้าหรือ MD ที่ได้รับมอบหมายเท่านั้น");
  }
  await ensureCycleOpen(ev.cycleId, { prisma });

  return prisma.evaluation.update({
    where: { id: ev.id },
    data: {
      status: "REJECTED",
      ...(byUserId === ev.managerId ? { managerComment: comment ?? ev.managerComment } : {}),
      ...(byUserId === ev.mdId     ? { mdComment: comment ?? ev.mdComment }       : {}),
      rejectedAt: new Date(),
    },
  });
}

export async function deleteEvaluation(id, { prisma = defaultPrisma } = {}) {
  return prisma.evaluation.delete({ where: { id } });
}

export async function listEvaluations(params = {}, { prisma = defaultPrisma } = {}) {
  const { cycleId, ownerId, status, managerId, mdId } = params;
  return prisma.evaluation.findMany({
    where: {
      ...(cycleId ? { cycleId } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(status ? { status } : {}),
      ...(managerId ? { managerId } : {}),
      ...(mdId ? { mdId } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      cycle: true,
      owner: {
        select: {
          id: true,
          firstNameTh: true,
          lastNameTh: true,
          primaryUserDept: {
            select: {
              positionLevel: true,
              department: {
                select: { id: true, code: true, nameTh: true, nameEn: true },
              },
            },
          },
        },
      },
      manager: { select: { id: true, firstNameTh: true, lastNameTh: true } },
      md: { select: { id: true, firstNameTh: true, lastNameTh: true } },
    },
  });
}

export async function listEligibleEvaluatees(
  cycleId,
  byUserId,
  opts = {},
  { prisma = defaultPrisma } = {}
) {
  if (byUserId == null) throw AppError.unauthorized();

  const { includeSelf = false, includeTaken = false } = opts;

  const me = await getPrimaryProfile({ prisma, userId: byUserId });

  const takenSet = new Set(
    (
      await prisma.evaluation.findMany({
        where: { cycleId },
        select: { ownerId: true },
      })
    ).map((x) => x.ownerId)
  );

  if (await isPrivileged({ prisma, me })) {
    const all = await prisma.user.findMany({
      where: { deletedAt: null, ...(includeSelf ? {} : { id: { not: byUserId } }) },
      select: {
        id: true,
        firstNameTh: true,
        lastNameTh: true,
        primaryUserDept: { select: { departmentId: true, positionLevel: true } },
      },
    });
    return all.filter((u) => includeTaken || !takenSet.has(u.id));
  }

  assertProfileComplete(me, "บัญชีผู้ประเมิน");

  const myDepts = me.memberships.map((m) => m.deptId);
  const myLevelByDept = new Map(me.memberships.map((m) => [m.deptId, m.level]));

  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(includeSelf ? {} : { id: { not: byUserId } }),
      primaryUserDept: { is: { departmentId: { in: myDepts } } },
    },
    select: {
      id: true,
      firstNameTh: true,
      lastNameTh: true,
      primaryUserDept: { select: { departmentId: true, positionLevel: true } },
    },
  });

  const out = [];
  for (const u of candidates) {
    if (!includeTaken && takenSet.has(u.id)) continue;
    const dept = u.primaryUserDept?.departmentId;
    const lvMine = myLevelByDept.get(dept);
    const lvHis = u.primaryUserDept?.positionLevel;
    if (dept != null && lvMine && rank(lvMine) > rank(lvHis)) {
      out.push({ id: u.id, firstNameTh: u.firstNameTh, lastNameTh: u.lastNameTh });
    }
  }
  if (out.length === 0 && includeSelf) {
    const selfUser = await prisma.user.findUnique({
      where: { id: byUserId },
      select: { id: true, firstNameTh: true, lastNameTh: true },
    });
    if (selfUser) out.push(selfUser);
  }
  return out;
}
