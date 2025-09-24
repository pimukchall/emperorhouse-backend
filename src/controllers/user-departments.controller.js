import { prisma } from "../prisma.js";
import {
  listAssignmentsService,
  addOrUpdateAssignmentService,
  endOrRenameAssignmentService,
  changeLevelService,
} from "../services/user-departments.service.js";

const mapErr = (e, kind) => {
  const table = {
    INVALID_DEPT: [400, "Invalid departmentId"],
    QMR_QMS: [400, "QMR must belong to QMS department"],
    MD_ALREADY_EXISTS_IN_DEPARTMENT: [409, "มี MD อยู่แล้วในแผนกนี้"],
    USER_DEPARTMENT_NOT_FOUND: [404, "ไม่พบข้อมูล assignment"],
    ENDED: [400, `Cannot ${String(kind || "change").toLowerCase()} ended assignment`],
    FORBIDDEN: [403, "Forbidden: insufficient privilege to set this level"],
    MISSING_TOLEVEL: [400, "toLevel required"],
    INVALID_POSITION_LEVEL: [400, "ระดับตำแหน่งไม่ถูกต้อง"],
  };
  return table[e?.message] || [e?.status || 400, e?.message || "Bad request"];
};

export async function listAssignmentsController(req, res) {
  try {
    const userId = Number(req.params.id);
    const data = await listAssignmentsService({ prisma, userId });
    res.json({ ok: true, data });
  } catch (e) {
    const [c, m] = mapErr(e);
    res.status(c).json({ ok: false, error: m });
  }
}

export async function addOrUpdateAssignmentController(req, res) {
  try {
    const userId = Number(req.params.id);
    const { departmentId, positionLevel, positionName, startedAt } = req.body || {};
    const data = await addOrUpdateAssignmentService({
      prisma,
      userId,
      departmentId,
      positionLevel,
      positionName,
      startedAt,
    });
    res.status(201).json({ ok: true, data });
  } catch (e) {
    const [c, m] = mapErr(e);
    res.status(c).json({ ok: false, error: m });
  }
}

export async function endOrRenameAssignmentController(req, res) {
  try {
    const udId = Number(req.params.udId);
    const { positionName, endedAt } = req.body || {};
    const data = await endOrRenameAssignmentService({ prisma, udId, positionName, endedAt });
    res.json({ ok: true, data });
  } catch (e) {
    const [c, m] = mapErr(e);
    res.status(c).json({ ok: false, error: m });
  }
}

export async function changeLevelController(req, res, kind) {
  try {
    const udId = Number(req.params.udId);
    const { toLevel, positionName, reason } = req.body || {};
    const data = await changeLevelService({
      prisma,
      udId,
      newLevel: toLevel,
      newPositionName: positionName,
      reason,
      actorId: req.user?.id || req.user?.id || req.userId || req.auth?.sub || null,
    });
    res.json({ ok: true, data });
  } catch (e) {
    const [c, m] = mapErr(e, kind);
    res.status(c).json({ ok: false, error: m });
  }
}
