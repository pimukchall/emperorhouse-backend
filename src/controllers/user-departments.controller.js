import { prisma } from "../prisma.js";
import {
  listAssignmentsService, addOrUpdateAssignmentService,
  endOrRenameAssignmentService, changeLevelService
} from "../services/user-departments.service.js";

const mapErr = (e, kind) => {
  const table = {
    INVALID_DEPT: [400, "Invalid departmentId"],
    QMR_QMS:      [400, "QMR must belong to QMS department"],
    MD_EXISTS:    [400, "This department already has an active MD"],
    NOT_FOUND:    [404, "Assignment not found"],
    ENDED:        [400, `Cannot ${String(kind||"change").toLowerCase()} ended assignment`],
    FORBIDDEN:    [403, "Forbidden: insufficient privilege to set this level"],
    MISSING_TOLEVEL: [400, "toLevel required"],
  };
  return table[e.message] || [400, e.message || "Bad request"];
};

export async function listAssignmentsController(req, res) {
  const userId = Number(req.params.id);
  const data = await listAssignmentsService({ prisma, userId });
  res.json({ ok: true, data });
}
export async function addOrUpdateAssignmentController(req, res) {
  try {
    const userId = Number(req.params.id);
    const { departmentId, positionLevel, positionName, startedAt, setPrimary } = req.body || {};
    const data = await addOrUpdateAssignmentService({
      prisma, actor: req.session?.user, userId, departmentId, positionLevel, positionName, startedAt, setPrimary
    });
    res.status(201).json({ ok: true, data });
  } catch (e) { const [c,m]=mapErr(e); res.status(c).json({ ok:false, error:m }); }
}
export async function endOrRenameAssignmentController(req, res) {
  try {
    const udId = Number(req.params.udId);
    const { positionName, endedAt } = req.body || {};
    const data = await endOrRenameAssignmentService({ prisma, udId, positionName, endedAt });
    res.json({ ok: true, data });
  } catch (e) { const [c,m]=mapErr(e); res.status(c).json({ ok:false, error:m }); }
}
export async function changeLevelController(req, res, kind) {
  try {
    const userId = Number(req.params.id);
    const udId   = Number(req.params.udId);
    const { toLevel, positionName, reason } = req.body || {};
    const data = await changeLevelService({
      prisma, actor: req.session?.user, userId, udId, toLevel, positionName, reason, kind
    });
    res.json({ ok: true, data });
  } catch (e) { const [c,m]=mapErr(e, kind); res.status(c).json({ ok:false, error:m }); }
}
