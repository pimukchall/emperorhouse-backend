import { prisma } from "../prisma.js";
import { err } from "../lib/errors.js";
import { computeScores } from "../lib/score.js";
import { isAdmin, isMD } from "../middlewares/roles.js"; // ใช้ helpers ที่มีอยู่แล้ว

/** ดึง primary dept + level + role ของ user (ให้พอสำหรับ helpers) */
async function getPrimaryProfile(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: { select: { name: true } },
      primaryUserDept: { select: { departmentId: true, positionLevel: true } },
    },
  });
  if (!u) throw err(404, "User not found");
  return {
    id: u.id,
    roleName: (u.role?.name ?? "user").toLowerCase(),
    deptId: u.primaryUserDept?.departmentId ?? null,
    level: u.primaryUserDept?.positionLevel ?? null,
  };
}

/** เปรียบ rank */
const Rank = { STAF: 1, SVR: 2, ASST: 3, MANAGER: 4, MD: 5 };
function rank(level) {
  return Rank[String(level || "").toUpperCase()] ?? 0;
}

/** เช็ครอบเปิด-ปิด */
export async function ensureCycleOpen(cycleId) {
  const c = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!c) throw err(404, "Evaluation cycle not found");
  const now = new Date();
  if (!c.isActive || now < c.openAt || now > c.closeAt) {
    throw err(403, "This cycle is closed", "CYCLE_CLOSED");
  }
  return c;
}

/** กติกา “ใครประเมินใคร” */
export async function canEvaluate(evaluatorId, evaluateeId) {
  if (evaluatorId === evaluateeId) return false;
  const ev = await getPrimaryProfile(evaluatorId);
  const ee = await getPrimaryProfile(evaluateeId);

  // ✅ admin หรือ MD (ตาม position level) : ประเมินได้ทุกคน
  if (isAdmin(ev) || isMD(ev)) return true;

  // ต้องแผนกเดียวกัน และระดับสูงกว่า
  return !!ev.deptId && ev.deptId === ee.deptId && rank(ev.level) > rank(ee.level);
}

/** CREATE: สร้างฟอร์ม (ถ้ามีอยู่แล้วในรอบเดียวกัน ให้คืนกลับ) */
export async function createEvaluation({ cycleId, ownerId, managerId, mdId, type, byUserId }) {
  await ensureCycleOpen(cycleId);

  // byUserId = คนกดสร้าง (หัวหน้าหรือ HR/admin/MD) → ถ้าไม่ใช่เจ้าตัวให้เช็คสิทธิ์
  if (byUserId && byUserId !== ownerId) {
    const ok = await canEvaluate(byUserId, ownerId);
    if (!ok) throw err(403, "You are not allowed to evaluate this user", "FORBIDDEN_EVALUATE");
  }

  // กันซ้ำ 1 คน/1 รอบ
  const exists = await prisma.evaluation.findUnique({
    where: { cycleId_ownerId: { cycleId, ownerId } },
  });
  if (exists) return exists;

  // ดึง stage จาก cycle
  const cyc = await prisma.evalCycle.findUnique({ where: { id: cycleId } });

  return prisma.evaluation.create({
    data: {
      ownerId,
      managerId,
      mdId,
      cycleId,
      stage: cyc.stage,
      type,
      status: "DRAFT",
    },
  });
}

/** READ by id */
export async function getEvaluation(id) {
  const row = await prisma.evaluation.findUnique({ where: { id } });
  if (!row) throw err(404, "Evaluation not found");
  return row;
}

/** UPDATE Draft fields (เฉพาะ DRAFT หรือถูก Rejected) */
export async function updateEvaluation(id, data, byUserId) {
  const ev = await getEvaluation(id);
  if (!["DRAFT", "REJECTED"].includes(ev.status)) throw err(409, "Cannot edit after submitted");
  await ensureCycleOpen(ev.cycleId);

  // อนุญาต: เจ้าของ หรือ HR/Admin (override)
  if (byUserId !== ev.ownerId) {
    const actor = await getPrimaryProfile(byUserId); // { roleName, ... }
    const canOverride = actor.roleName === "admin" || actor.roleName === "hr";
    if (!canOverride) throw err(403, "Only owner (or HR/Admin) can edit draft");
  }

  return prisma.evaluation.update({ where: { id }, data });
}

/** SUBMIT (owner ยื่น), คำนวณคะแนน cache */
export async function submitEvaluation(id, byUserId) {
  const ev = await getEvaluation(id);
  if (byUserId !== ev.ownerId) throw err(403, "Only owner can submit");
  await ensureCycleOpen(ev.cycleId);

  const scores = computeScores(ev, ev.type);
  return prisma.evaluation.update({
    where: { id },
    data: { ...scores, status: "SUBMITTED", submittedAt: new Date() },
  });
}

/** APPROVE (หัวหน้า) */
export async function approveByManager(id, byUserId, comment) {
  const ev = await getEvaluation(id);
  if (ev.status !== "SUBMITTED") throw err(409, "Evaluation must be SUBMITTED");
  if (byUserId !== ev.managerId) throw err(403, "Only assigned manager can approve");
  await ensureCycleOpen(ev.cycleId);

  return prisma.evaluation.update({
    where: { id },
    data: {
      status: "APPROVER_APPROVED",
      managerComment: comment ?? ev.managerComment,
      approverAt: new Date(),
    },
  });
}

/** APPROVE (MD) → เสร็จสิ้น */
export async function approveByMD(id, byUserId, comment) {
  const ev = await getEvaluation(id);
  if (!["APPROVER_APPROVED", "SUBMITTED"].includes(ev.status))
    throw err(409, "Must be approved by manager first (or submitted)");
  if (byUserId !== ev.mdId) throw err(403, "Only assigned MD can approve");
  await ensureCycleOpen(ev.cycleId);

  return prisma.evaluation.update({
    where: { id },
    data: {
      status: "COMPLETED",
      mdComment: comment ?? ev.mdComment,
      mdAt: new Date(),
      completedAt: new Date(),
    },
  });
}

/** REJECT (หัวหน้าหรือ MD) */
export async function rejectEvaluation(id, byUserId, comment) {
  const ev = await getEvaluation(id);
  if (!["SUBMITTED", "APPROVER_APPROVED"].includes(ev.status)) throw err(409, "Invalid state to reject");
  if (![ev.managerId, ev.mdId].includes(byUserId)) throw err(403, "Only manager or MD can reject");
  await ensureCycleOpen(ev.cycleId);

  return prisma.evaluation.update({
    where: { id },
    data: {
      status: "REJECTED",
      managerComment: comment ?? ev.managerComment,
      mdComment: comment ?? ev.mdComment,
      rejectedAt: new Date(),
    },
  });
}

/** DELETE (admin/HR only) — สิทธิ์คุมที่ route แล้ว */
export async function deleteEvaluation(id) {
  return prisma.evaluation.delete({ where: { id } });
}

/** LIST by cycle / owner / status */
export async function listEvaluations(params = {}) {
  const { cycleId, ownerId, status } = params;
  return prisma.evaluation.findMany({
    where: {
      ...(cycleId ? { cycleId } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

/** รายชื่อผู้ที่ “ฉัน” มีสิทธิ์สร้างให้ใน cycle (หัวหน้า/MD/admin) */
export async function listEligibleEvaluatees(cycleId, byUserId) {
  const by = await getPrimaryProfile(byUserId);

  // ✅ admin หรือ MD : ได้ทุกคนที่ยังไม่มีฟอร์มในรอบนี้
  if (isAdmin(by) || isMD(by)) {
    const taken = await prisma.evaluation.findMany({
      where: { cycleId },
      select: { ownerId: true },
    });
    const takenSet = new Set(taken.map((r) => r.ownerId));
    const all = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, firstNameTh: true, lastNameTh: true },
    });
    return all.filter((u) => !takenSet.has(u.id));
  }

  // หัวหน้า: แผนกเดียวกันและระดับต่ำกว่า + ยังไม่มีฟอร์ม
  const peers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      primaryUserDept: { is: { departmentId: by.deptId } }, // เขียนให้สั้นลง
    },
    select: {
      id: true,
      firstNameTh: true,
      lastNameTh: true,
      primaryUserDept: { select: { positionLevel: true } },
    },
  });
  const taken = await prisma.evaluation.findMany({
    where: { cycleId },
    select: { ownerId: true },
  });
  const takenSet = new Set(taken.map((r) => r.ownerId));
  return peers.filter(
    (p) => rank(p.primaryUserDept?.positionLevel) < rank(by.level) && !takenSet.has(p.id)
  );
}
