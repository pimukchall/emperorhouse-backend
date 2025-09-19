import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireRole, requireAuth } from "../middlewares/auth.js";

export const router = Router({ mergeParams: true }); // <- ต้อง mergeParams

// helper: parse id จาก params
const toInt = (v) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

/**
 * GET /api/users/:id/departments
 * รายการสังกัดทั้งหมด (ประวัติ + ปัจจุบัน)
 */
router.get("/", requireAuth, async (req, res) => {
  const userId = toInt(req.params.id);
  const items = await prisma.userDepartment.findMany({
    where: { userId },
    orderBy: [{ endedAt: "asc" }, { startedAt: "desc" }],
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      positionLevel: true,
      positionName: true,
      department: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
      },
    },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryUserDeptId: true },
  });
  res.json({
    ok: true,
    data: items.map((x) => ({
      ...x,
      isPrimary: x.id === user?.primaryUserDeptId,
    })),
  });
});

/**
 * POST /api/users/:id/departments
 * เพิ่มสังกัดใหม่ (active) หรือถ้ามี active อยู่แล้วในแผนกเดียวกัน
 * จะ "อัปเดต" level/name และตั้ง primary ให้ตาม flag (idempotent)
 * body: { departmentId, positionLevel, positionName?, startedAt?, setPrimary? }
 */
router.post("/", requireRole("admin"), async (req, res) => {
  const userId = toInt(req.params.id);
  const { departmentId, positionLevel, positionName, startedAt, setPrimary } = req.body || {};

  if (!departmentId || !positionLevel) {
    return res.status(400).json({ ok: false, error: "departmentId & positionLevel required" });
  }

  // business rule (ตัวเลือก): ถ้าตั้งชื่อ QMR ต้องอยู่แผนก QMS
  if (String(positionName || "").trim().toUpperCase() === "QMR") {
    const qms = await prisma.department.findUnique({ where: { code: "QMS" } });
    if (!qms || Number(departmentId) !== qms.id) {
      return res.status(400).json({ ok: false, error: "QMR must belong to QMS department" });
    }
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    // มี active ในแผนกนี้อยู่แล้วไหม?
    const existing = await tx.userDepartment.findFirst({
      where: { userId, departmentId: Number(departmentId), endedAt: null },
      select: { id: true },
    });

    if (existing) {
      // อัปเดตแทน (idempotent)
      const upd = await tx.userDepartment.update({
        where: { id: existing.id },
        data: {
          positionLevel,
          positionName: positionName ?? null,
          // ไม่ยุ่งกับ startedAt เดิม เพื่อรักษาประวัติ
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          positionLevel: true,
          positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        },
      });

      if (setPrimary) {
        await tx.user.update({ where: { id: userId }, data: { primaryUserDeptId: upd.id } });
      }
      return { created: false, payload: upd };
    }

    // ไม่มี → สร้างใหม่
    const ud = await tx.userDepartment.create({
      data: {
        userId,
        departmentId: Number(departmentId),
        positionLevel,
        positionName: positionName || null,
        startedAt: startedAt ? new Date(startedAt) : now,
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        positionLevel: true,
        positionName: true,
        department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
      },
    });

    if (setPrimary) {
      await tx.user.update({ where: { id: userId }, data: { primaryUserDeptId: ud.id } });
    }
    return { created: true, payload: ud };
  });

  // 200 ถ้าอัปเดต, 201 ถ้าสร้างใหม่
  return res.status(result.created ? 201 : 200).json({ ok: true, data: result.payload });
});


/**
 * PATCH /api/users/:id/departments/:udId
 * แก้ไขตำแหน่ง, ชื่อตำแหน่ง หรือปิด assignment (ใส่ endedAt)
 * body: { positionLevel?, positionName?, endedAt? }
 */
router.patch("/:udId", requireRole("admin"), async (req, res) => {
  const userId = toInt(req.params.id);
  const udId = toInt(req.params.udId);
  const { positionLevel, positionName, endedAt } = req.body || {};

  const data = {};
  if (positionLevel !== undefined) data.positionLevel = positionLevel;
  if (positionName !== undefined) data.positionName = positionName || null;
  if (endedAt !== undefined) data.endedAt = endedAt ? new Date(endedAt) : null;

  const updated = await prisma.userDepartment.update({
    where: { id: udId },
    data,
    select: {
      id: true,
      userId: true,
      departmentId: true,
      startedAt: true,
      endedAt: true,
      positionLevel: true,
      positionName: true,
    },
  });

  // ถ้าอันที่แก้คือ primary แล้วถูก set endedAt → เอา primary ออก (ให้ว่าง)
  if (updated.endedAt) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { primaryUserDeptId: true },
    });
    if (u?.primaryUserDeptId === udId) {
      await prisma.user.update({
        where: { id: userId },
        data: { primaryUserDeptId: null },
      });
    }
  }

  res.json({ ok: true, data: updated });
});

/**
 * POST /api/users/:id/departments/:udId/primary
 * ตั้ง assignment นี้เป็น primary (ไม่ต้องปิดตัวเดิม)
 */
router.post("/:udId/primary", requireRole("admin"), async (req, res) => {
  const userId = toInt(req.params.id);
  const udId = toInt(req.params.udId);
  const ud = await prisma.userDepartment.findUnique({
    where: { id: udId },
    select: { id: true, userId: true, endedAt: true },
  });
  if (!ud || ud.userId !== userId) {
    return res.status(404).json({ ok: false, error: "Assignment not found" });
  }
  if (ud.endedAt) {
    return res
      .status(400)
      .json({ ok: false, error: "Cannot set ended assignment as primary" });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { primaryUserDeptId: udId },
  });
  res.json({ ok: true });
});

/**
 * POST /api/users/:id/departments/:udId/promote
 * body: { toLevel, reason? }
 * เปลี่ยน level ของ assignment + บันทึก PositionChangeLog(kind=PROMOTE)
 */
router.post("/:udId/promote", requireRole("admin"), async (req, res) => {
  const userId = toInt(req.params.id);
  const udId = toInt(req.params.udId);
  const { toLevel, reason } = req.body || {};
  if (!toLevel) return res.status(400).json({ ok: false, error: "toLevel required" });

  const ud = await prisma.userDepartment.findUnique({
    where: { id: udId },
    select: { id: true, userId: true, endedAt: true, positionLevel: true, positionName: true, departmentId: true },
  });
  if (!ud || ud.userId !== userId) return res.status(404).json({ ok: false, error: "Assignment not found" });
  if (ud.endedAt) return res.status(400).json({ ok: false, error: "Cannot promote ended assignment" });

  const updated = await prisma.$transaction(async (tx) => {
    const after = await tx.userDepartment.update({
      where: { id: udId },
      data: { positionLevel: toLevel },
    });
    await tx.positionChangeLog.create({
      data: {
        kind: "PROMOTE",
        userId,
        fromDepartmentId: ud.departmentId,
        toDepartmentId: ud.departmentId,
        fromLevel: ud.positionLevel,
        toLevel: toLevel,
        fromName: ud.positionName,
        toName: ud.positionName,
        effectiveDate: new Date(),
        reason: reason || null,
        actorId: req.session?.user?.id || null,
      },
    });
    return after;
  });

  res.json({ ok: true, data: updated });
});

/**
 * POST /api/users/:id/departments/:udId/demote
 * body: { toLevel, reason? }
 * เปลี่ยน level ของ assignment + บันทึก PositionChangeLog(kind=DEMOTE)
 */
router.post("/:udId/demote", requireRole("admin"), async (req, res) => {
  const userId = toInt(req.params.id);
  const udId = toInt(req.params.udId);
  const { toLevel, reason } = req.body || {};
  if (!toLevel) return res.status(400).json({ ok: false, error: "toLevel required" });

  const ud = await prisma.userDepartment.findUnique({
    where: { id: udId },
    select: { id: true, userId: true, endedAt: true, positionLevel: true, positionName: true, departmentId: true },
  });
  if (!ud || ud.userId !== userId) return res.status(404).json({ ok: false, error: "Assignment not found" });
  if (ud.endedAt) return res.status(400).json({ ok: false, error: "Cannot demote ended assignment" });

  const updated = await prisma.$transaction(async (tx) => {
    const after = await tx.userDepartment.update({
      where: { id: udId },
      data: { positionLevel: toLevel },
    });
    await tx.positionChangeLog.create({
      data: {
        kind: "DEMOTE",
        userId,
        fromDepartmentId: ud.departmentId,
        toDepartmentId: ud.departmentId,
        fromLevel: ud.positionLevel,
        toLevel: toLevel,
        fromName: ud.positionName,
        toName: ud.positionName,
        effectiveDate: new Date(),
        reason: reason || null,
        actorId: req.session?.user?.id || null,
      },
    });
    return after;
  });

  res.json({ ok: true, data: updated });
});

export default router;
