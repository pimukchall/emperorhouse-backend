import { asyncHandler } from "#utils/asyncHandler.js";
import {
  listAssignmentsService,
  listByUserService,
  assignUserToDepartmentService,
  endOrRenameAssignmentService,
  changeLevelService,
  setPrimaryAssignmentService,
} from "./service.js";

/* ---------------- List all assignments (with filters) ---------------- */
// GET /api/user-departments
export const listAssignmentsController = [
  asyncHandler(async (req, res) => {
    // ✅ activeOnly ถูก validate แล้วเป็น boolean
    const {
      page = 1,
      limit = 20,
      q = "",
      activeOnly = false,
      departmentId,
      userId,
    } = req.query;

    const result = await listAssignmentsService({
      page: Number(page),
      limit: Number(limit),
      q: String(q || ""),
      activeOnly: Boolean(activeOnly),
      departmentId: departmentId != null ? Number(departmentId) : undefined,
      userId: userId != null ? Number(userId) : undefined,
    });

    res.json({ ok: true, ...result });
  }),
];

/* ---------------- List by user ---------------- */
// GET /api/user-departments/user/:userId
export const listByUserController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    const { activeOnly = false } = req.query;

    const result = await listByUserService({
      userId,
      activeOnly: Boolean(activeOnly),
    });
    res.json({ ok: true, ...result });
  }),
];

/* ---------------- Assign user to department ---------------- */
// POST /api/user-departments/assign
export const assignController = [
  asyncHandler(async (req, res) => {
    const actorId = Number(req.me?.id || req.user?.id || req.auth?.sub);
    const payload = req.body;
    const result = await assignUserToDepartmentService({ actorId, payload });
    res.json({ ok: true, assignment: result });
  }),
];

/* ---------------- End assignment / Rename position ---------------- */
// PATCH /api/user-departments/:id/end-or-rename
export const endOrRenameController = [
  asyncHandler(async (req, res) => {
    const actorId = Number(req.me?.id || req.user?.id || req.auth?.sub);
    const id = Number(req.params.id);
    const body = req.body;

    const result = await endOrRenameAssignmentService({
      actorId,
      id,
      endedAt: body?.endedAt,
      newPositionName: body?.newPositionName,
      reason: body?.reason,
      effectiveDate: body?.effectiveDate,
    });

    res.json({ ok: true, assignment: result });
  }),
];

/* ---------------- Change level ---------------- */
// PATCH /api/user-departments/:id/change-level
export const changeLevelController = [
  asyncHandler(async (req, res) => {
    const actorId = Number(req.me?.id || req.user?.id || req.auth?.sub);
    const id = Number(req.params.id);
    const { toLevel, newPositionName, reason, effectiveDate } = req.body;

    const result = await changeLevelService({
      actorId,
      id,
      toLevel,
      newPositionName,
      reason,
      effectiveDate,
    });

    res.json({ ok: true, assignment: result });
  }),
];

/* ---------------- Set primary for user ---------------- */
// PATCH /api/user-departments/:id/set-primary
export const setPrimaryController = [
  asyncHandler(async (req, res) => {
    const actorId = Number(req.me?.id || req.user?.id || req.auth?.sub);
    const id = Number(req.params.id);
    const result = await setPrimaryAssignmentService({ actorId, id });
    res.json({ ok: true, assignment: result });
  }),
];
