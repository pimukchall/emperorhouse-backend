import { asyncHandler } from "#utils/asyncHandler.js";
import {
  assignUserToDepartmentService,
  endOrRenameAssignmentService,
  changeLevelService,
  listAssignmentsService,
  listAssignmentsByUser,
  setPrimaryAssignmentService,
} from "./service.js";

// GET /api/user-departments/:id?activeOnly=true   (id = userId)
export const listAssignmentsController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const activeOnly = Boolean(req.query.activeOnly);
    const data = await listAssignmentsService({ userId, activeOnly });
    res.json({ ok: true, data });
  }),
];

// GET /api/user-departments/users/:userId?activeOnly=true
export const listByUserController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const activeOnly = Boolean(req.query.activeOnly);
    const data = await listAssignmentsByUser({ userId, activeOnly });
    res.json({ ok: true, data });
  }),
];

// POST /api/user-departments
export const addOrUpdateAssignmentController = [
  asyncHandler(async (req, res) => {
    const out = await assignUserToDepartmentService({ ...req.body });
    res.status(201).json({ ok: true, data: out });
  }),
];

// POST /api/user-departments/change-level
export const changeLevelController = [
  asyncHandler(async (req, res) => {
    const out = await changeLevelService({
      ...req.body,
      actorId: req.me?.id ?? null, // ตั้งจากผู้ที่ยิงคำสั่ง
    });
    res.json({ ok: true, data: out });
  }),
];

// PATCH /api/user-departments/:udId
export const endOrRenameAssignmentController = [
  asyncHandler(async (req, res) => {
    const udId = Number(req.params.udId);
    const out = await endOrRenameAssignmentService({ udId, ...req.body });
    res.json({ ok: true, data: out });
  }),
];

// POST /api/user-departments/users/:userId/primary/:udId
export const setPrimaryController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const udId = Number(req.params.udId);
    const out = await setPrimaryAssignmentService({ userId, udId });
    res.json({ ok: true, data: out });
  }),
];
