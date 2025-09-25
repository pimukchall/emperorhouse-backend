// src/services/eval.service.js
import { prisma } from "../prisma.js";
import { err } from "../lib/errors.js";
import { computeScores } from "../lib/score.js";
import { isAdmin, isMD } from "../middlewares/roles.js";

/** =========================================================
 * Helpers: ranks, signatures, profiles (multi-department aware)
 * ========================================================= */
const Rank = { STAF: 1, SVR: 2, ASST: 3, MANAGER: 4, MD: 5 };
const rank = (lv) => Rank[String(lv || "").toUpperCase()] ?? -1;

function toBuffer(sig) {
  if (!sig) return null;
  if (Buffer.isBuffer(sig)) return sig;
  const s = String(sig);
  const b64 = s.startsWith("data:") ? s.replace(/^data:.*;base64,/, "") : s;
  try { return Buffer.from(b64, "base64"); } catch { return null; }
}
function requireSignature(sig) {
  const buf = toBuffer(sig);
  if (!buf || buf.length < 16) throw err(400, "ต้องมีลายเซ็น");
  return buf;
}

function isPrivileged(me) {
  const role = (me?.roleName || "").toLowerCase();
  if (role === "admin" || role === "hr") return true;
  // ถ้าเป็น MD ในอย่างน้อยหนึ่งแผนก ก็ถือว่าสิทธิ์พิเศษ
  const hasMDLevel =
    (me?.primaryLevel && String(me.primaryLevel).toUpperCase() === "MD") ||
    (Array.isArray(me?.memberships) && me.memberships.some(m => String(m?.level || "").toUpperCase() === "MD"));
  return hasMDLevel;
}

// active memberships ของผู้ใช้ทั้งหมด (ไม่ใช่แค่ primary)
async function getActiveMemberships(userId) {
  const rows = await prisma.userDepartment.findMany({
    where: { userId, isActive: true },
    select: { departmentId: true, positionLevel: true },
  });
  return rows.map(r => ({ deptId: r.departmentId, level: r.positionLevel }));
}

async function getPrimaryProfile(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: { select: { name: true } },
      primaryUserDept: { select: { departmentId: true, positionLevel: true } },
    },
  });
  if (!u) throw err(404, "ไม่พบข้อมูลผู้ใช้");

  const memberships = await getActiveMemberships(userId);
  return {
    id: u.id,
    roleName: (u.role?.name ?? "").toLowerCase(), // อาจว่างได้
    primaryDeptId: u.primaryUserDept?.departmentId ?? null,
    primaryLevel:  u.primaryUserDept?.positionLevel ?? null,
    memberships, // [{deptId, level}, ...] อาจหลายอัน
  };
}

// โปรไฟล์ต้องมี: roleName (ไม่ว่าง) + มี membership ที่ valid อย่างน้อย 1 อัน
function assertProfileComplete(p, who = "บัญชีผู้ใช้") {
  const lacksRole = !p.roleName || p.roleName.trim() === "";
  const validMemberships = Array.isArray(p.memberships)
    ? p.memberships.filter(m => m?.deptId != null && (m?.level ?? "") !== "")
    : [];
  if (lacksRole || validMemberships.length === 0) {
    throw err(400, `${who} ยังไม่ได้ตั้งค่า role/department/positionLevel`, "PROFILE_INCOMPLETE");
  }
}

/** =========================================================
 * Cycle guard
 * ========================================================= */
export async function ensureCycleOpen(cycleId) {
  const c = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!c) throw err(404, "ไม่พบรอบการประเมิน");
  const now = new Date();
  if (!c.isActive || now < c.openAt || now > c.closeAt) {
    throw err(403, "รอบการประเมินไม่เปิดใช้งาน", "CYCLE_CLOSED");
  }
  return c;
}

/** =========================================================
 * Rules: ใครประเมินใครได้ (รองรับหลายแผนก)
 * ========================================================= */
export async function canEvaluate(evaluatorId, evaluateeId) {
  // self-assessment อนุญาตเสมอ
  if (evaluatorId === evaluateeId) return true;

  const ev = await getPrimaryProfile(evaluatorId);
  const ee = await getPrimaryProfile(evaluateeId);

  // ประเมินคนอื่น → ต้องมี role + มี membership อย่างน้อยหนึ่งอัน
  assertProfileComplete(ev, "บัญชีผู้ประเมิน");

  // Admin/MD → ประเมินใครก็ได้ (ไม่ต้องจำกัดแผนก)
  if (isAdmin(ev) || isMD(ev)) return true;

  // ผู้ถูกประเมินต้องมี primary dept/level
  const eeDept = ee.primaryDeptId;
  const eeLevel = ee.primaryLevel;
  if (eeDept == null || (eeLevel ?? "") === "") return false;

  // ผ่านหาก "หนึ่งใน" แผนกของผู้ประเมิน ตรงกับ primary dept ของผู้ถูกประเมิน
  // และระดับ (ในแผนกนั้น) สูงกว่า
  return ev.memberships.some(m => m.deptId === eeDept && rank(m.level) > rank(eeLevel));
}

/** =========================================================
 * CREATE
 * ========================================================= */
export async function createEvaluation({ cycleId, ownerId, managerId, mdId, type, byUserId }) {
  await ensureCycleOpen(cycleId);

  // ถ้าสร้างให้ "คนอื่น" → ต้องเช็กสิทธิ์/โปรไฟล์
  if (byUserId && byUserId !== ownerId) {
    const actor = await getPrimaryProfile(byUserId);
    assertProfileComplete(actor, "บัญชีผู้ประเมิน");
    const ok = await canEvaluate(byUserId, ownerId);
    if (!ok) throw err(403, "คุณไม่มีสิทธิ์ประเมินผู้ใช้คนนี้", "FORBIDDEN_EVALUATE");
  }

  // กันซ้ำ 1 คน/1 รอบ
  const exists = await prisma.evaluation.findUnique({
    where: { cycleId_ownerId: { cycleId, ownerId } },
  });
  if (exists) return exists;

  const cyc = await prisma.evalCycle.findUnique({ where: { id: cycleId } });
  if (!cyc) throw err(404, "ไม่พบรอบการประเมิน");

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

/** =========================================================
 * READ / UPDATE  (include ความสัมพันธ์ให้ FE ใช้ได้ทันที)
 * ========================================================= */
export async function getEvaluation(id) {
  const row = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      cycle: true,
      owner: {
        select: {
          id: true, firstNameTh: true, lastNameTh: true,
          primaryUserDept: {
            select: {
              positionLevel: true,
              department: { select: { id: true, code: true, nameTh: true, nameEn: true } }
            }
          }
        }
      },
      manager: { select: { id: true, firstNameTh: true, lastNameTh: true } },
      md:      { select: { id: true, firstNameTh: true, lastNameTh: true } },
    }
  });
  if (!row) throw err(404, "ไม่พบแบบฟอร์มการประเมิน");
  return row;
}

export async function updateEvaluation(id, data, byUserId) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw err(404, "ไม่พบแบบฟอร์มการประเมิน");
  if (!["DRAFT", "REJECTED"].includes(ev.status)) throw err(409, "ไม่สามารถแก้ไขหลังส่งแล้ว");
  await ensureCycleOpen(ev.cycleId);

  // เจ้าของ หรือ HR/Admin
  if (byUserId !== ev.ownerId) {
    const actor = await getPrimaryProfile(byUserId);
    const canOverride = actor.roleName === "admin" || actor.roleName === "hr";
    if (!canOverride) throw err(403, "เฉพาะเจ้าของ (หรือ HR/Admin) ที่สามารถแก้ไขร่างได้");
  }
  return prisma.evaluation.update({ where: { id }, data });
}

/** =========================================================
 * SUBMIT (owner) — ต้องโปรไฟล์ครบ + บังคับลายเซ็น + คำนวณคะแนน + auto-skip
 * ========================================================= */
export async function submitEvaluation(id, byUserId, payload = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw err(404, "ไม่พบแบบฟอร์มการประเมิน");
  if (byUserId !== ev.ownerId) throw err(403, "เฉพาะเจ้าของเท่านั้นที่สามารถส่งฟอร์มได้");
  await ensureCycleOpen(ev.cycleId);

  // ผู้ยื่นต้องโปรไฟล์ครบ
  const ownerProfile = await getPrimaryProfile(byUserId);
  assertProfileComplete(ownerProfile, "บัญชีผู้ยื่น");

  const submitterSignature = requireSignature(payload.signature);
  const now = new Date();

  // คำนวณคะแนนล่าสุดจากข้อมูลในฟอร์มปัจจุบัน
  const scores = computeScores(ev, ev.type);

  // เริ่ม SUBMITTED
  const data = {
    ...scores,
    status: "SUBMITTED",
    submittedAt: now,
    submitterSignedAt: now,
    submitterComment: payload.comment ?? null,
    submitterSignature,
    ...(ev.createdById ? {} : { createdById: byUserId }), // กันข้อมูลเก่า
  };

  const isSelfMgr = ev.managerId && ev.managerId === ev.ownerId;
  const isSelfMD  = ev.mdId && ev.mdId === ev.ownerId;

  // ไม่มี managerId หรือ owner เป็น manager ของตนเอง ⇒ ข้ามขั้นหัวหน้า
  if (isSelfMgr || !ev.managerId) {
    Object.assign(data, {
      status: "APPROVER_APPROVED",
      approverAt: now,
      managerSignedAt: now,
      managerSignature: submitterSignature,
    });
  }

  // ไม่มี mdId หรือ owner เป็น MD ของตนเอง ⇒ จบเลย
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

/** =========================================================
 * APPROVE (Manager) — โปรไฟล์ครบ + ลายเซ็น (+ ข้าม MD ถ้าตรงเงื่อนไข)
 * ========================================================= */
export async function approveByManager(id, byUserId, payload = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw err(404, "ไม่พบแบบฟอร์มการประเมิน");
  if (ev.status !== "SUBMITTED") throw err(409, "ต้องส่งฟอร์มก่อนอนุมัติ");
  if (byUserId !== ev.managerId) throw err(403, "เฉพาะหัวหน้าที่ได้รับมอบหมายเท่านั้น");
  await ensureCycleOpen(ev.cycleId);

  const mgr = await getPrimaryProfile(byUserId);
  assertProfileComplete(mgr, "บัญชีหัวหน้า");

  const sig = requireSignature(payload.signature);
  const now = new Date();
  const data = {
    status: "APPROVER_APPROVED",
    approverAt: now,
    managerComment: payload.comment ?? ev.managerComment,
    managerSignedAt: now,
    managerSignature: sig,
  };

  // ถ้า MD เป็นคนเดียวกัน หรือ ไม่มี mdId → ข้าม MD และจบ
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

/** =========================================================
 * APPROVE (MD) — โปรไฟล์ครบ + ลายเซ็น (จบงาน)
 * ========================================================= */
export async function approveByMD(id, byUserId, payload = {}) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw err(404, "ไม่พบแบบฟอร์มการประเมิน");
  if (ev.status !== "APPROVER_APPROVED") throw err(409, "ต้องได้รับการอนุมัติจากหัวหน้าก่อน");
  if (byUserId !== ev.mdId) throw err(403, "เฉพาะ MD ที่ได้รับมอบหมายเท่านั้น");
  await ensureCycleOpen(ev.cycleId);

  const md = await getPrimaryProfile(byUserId);
  assertProfileComplete(md, "บัญชี MD");

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

/** =========================================================
 * REJECT (หัวหน้า/MD) — โปรไฟล์ครบ
 * ========================================================= */
export async function rejectEvaluation(id, byUserId, comment) {
  const ev = await prisma.evaluation.findUnique({ where: { id } });
  if (!ev) throw err(404, "ไม่พบแบบฟอร์มการประเมิน");
  if (!["SUBMITTED", "APPROVER_APPROVED"].includes(ev.status)) {
    throw err(409, "ไม่สามารถปฏิเสธได้ในสถานะนี้");
  }
  if (![ev.managerId, ev.mdId].includes(byUserId)) {
    throw err(403, "เฉพาะหัวหน้าหรือ MD ที่ได้รับมอบหมายเท่านั้น");
  }
  await ensureCycleOpen(ev.cycleId);

  const approver = await getPrimaryProfile(byUserId);
  assertProfileComplete(approver, "บัญชีผู้อนุมัติ/ปฏิเสธ");

  return prisma.evaluation.update({
    where: { id: ev.id },
    data: {
      status: "REJECTED",
      ...(byUserId === ev.managerId ? { managerComment: comment ?? ev.managerComment } : {}),
      ...(byUserId === ev.mdId ? { mdComment: comment ?? ev.mdComment } : {}),
      rejectedAt: new Date(),
    },
  });
}

/** =========================================================
 * DELETE (admin/HR only) — สิทธิ์คุมที่ route แล้ว
 * ========================================================= */
export async function deleteEvaluation(id) {
  return prisma.evaluation.delete({ where: { id } });
}

/** =========================================================
 * LIST (include ความสัมพันธ์)
 * ========================================================= */
export async function listEvaluations(params = {}) {
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
          id: true, firstNameTh: true, lastNameTh: true,
          primaryUserDept: {
            select: {
              positionLevel: true,
              department: { select: { id: true, code: true, nameTh: true, nameEn: true } }
            }
          }
        }
      },
      manager: { select: { id: true, firstNameTh: true, lastNameTh: true } },
      md:      { select: { id: true, firstNameTh: true, lastNameTh: true } },
    },
  });
}

/** =========================================================
 * Eligible evaluatees (รองรับหลายแผนก)
 * ========================================================= */
export async function listEligibleEvaluatees(cycleId, byUserId, opts = {}) {
  // ✅ กันเคสยังไม่ล็อกอินหรือไม่มี req.me.id จาก controller
  if (byUserId == null) {
    throw err(401, "UNAUTHORIZED");
  }

  const { includeSelf = false, includeTaken = false } = opts;
  const me = await getPrimaryProfile(byUserId);

  // รายชื่อที่มีฟอร์มแล้วในรอบนี้
  const takenSet = new Set(
    (await prisma.evaluation.findMany({ where: { cycleId }, select: { ownerId: true } }))
      .map(x => x.ownerId)
  );

  // ---------- สิทธิ์พิเศษ: admin/hr หรือมี level = MD ที่ใดก็ได้ ----------
  if (isPrivileged(me)) {
    const all = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(includeSelf ? {} : { id: { not: byUserId } }),
      },
      select: {
        id: true, firstNameTh: true, lastNameTh: true,
        primaryUserDept: { select: { departmentId: true, positionLevel: true } },
      },
    });
    return all.filter(u => includeTaken || !takenSet.has(u.id));
  }

  // ---------- ผู้ประเมินทั่วไป: ต้องมี membership อย่างน้อยหนึ่งอัน ----------
  assertProfileComplete(me, "บัญชีผู้ประเมิน");
  const myDepts = me.memberships.map(m => m.deptId);
  const myLevelByDept = new Map(me.memberships.map(m => [m.deptId, m.level]));

  // ผู้ถูกประเมิน: primary dept ต้องอยู่ในหนึ่งในแผนกของเรา
  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(includeSelf ? {} : { id: { not: byUserId } }),
      primaryUserDept: { is: { departmentId: { in: myDepts } } },
    },
    select: {
      id: true,
      firstNameTh: true, lastNameTh: true,
      primaryUserDept: { select: { departmentId: true, positionLevel: true } },
    },
  });

  const out = [];
  for (const u of candidates) {
    if (!includeTaken && takenSet.has(u.id)) continue;
    const dept = u.primaryUserDept?.departmentId;
    const lvMine = myLevelByDept.get(dept);
    const lvHis  = u.primaryUserDept?.positionLevel;
    if (dept != null && lvMine && rank(lvMine) > rank(lvHis)) {
      out.push({ id: u.id, firstNameTh: u.firstNameTh, lastNameTh: u.lastNameTh });
    }
  }

  // ถ้าลิสต์ยังว่าง และขอ includeSelf → เติมตัวเองให้เป็น fallback
  if (out.length === 0 && includeSelf) {
    const selfUser = await prisma.user.findUnique({
      where: { id: byUserId },
      select: { id: true, firstNameTh: true, lastNameTh: true },
    });
    if (selfUser) out.push(selfUser);
  }

  return out;
}
