import { z } from "zod";
import { asyncHandler } from "#utils/asyncHandler.js";
import { validate } from "#mw/validate.js";
import {
  assignUserToDepartmentService,
  endOrRenameAssignmentService,
  changeLevelService,
  listAssignmentsService,
  listAssignmentsByUser,
  setPrimaryAssignmentService,
} from "./service.js";

const assignSchema = z.object({
  userId: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  positionLevel: z.enum(["STAF", "SVR", "ASST", "MANAGER", "MD"]),
  positionName: z.string().trim().nullable().optional(),
  startedAt: z.string().datetime().optional(),
});
const endOrRenameSchema = z.object({
  positionName: z.string().trim().nullable().optional(),
  endedAt: z.string().datetime().optional(),
});
const changeLevelSchema = z.object({
  udId: z.number().int().positive(),
  newLevel: z.enum(["STAF", "SVR", "ASST", "MANAGER", "MD"]),
  actorId: z.number().int().positive().nullable().optional(),
  effectiveDate: z.string().datetime().optional(),
  reason: z.string().trim().nullable().optional(),
  newPositionName: z.string().trim().nullable().optional(),
});

// GET /api/user-departments/:id?activeOnly=true
export const listAssignmentsController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    const activeOnly = String(req.query.activeOnly || "") === "true";
    const data = await listAssignmentsService({ userId, activeOnly });
    res.json({ ok: true, data });
  }),
];

// GET /api/user-departments/users/:userId?activeOnly=true
export const listByUserController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const activeOnly = String(req.query.activeOnly || "") === "true";
    const data = await listAssignmentsByUser({ userId, activeOnly });
    res.json({ ok: true, data });
  }),
];

// POST /api/user-departments
export const addOrUpdateAssignmentController = [
  validate(assignSchema),
  asyncHandler(async (req, res) => {
    const out = await assignUserToDepartmentService({ ...req.body });
    res.status(201).json({ ok: true, data: out });
  }),
];

// POST /api/user-departments/change-level
export const changeLevelController = [
  validate(changeLevelSchema),
  asyncHandler(async (req, res) => {
    const out = await changeLevelService({
      ...req.body,
      actorId: req.me?.id ?? null,
    });
    res.json({ ok: true, data: out });
  }),
];

// PATCH /api/user-departments/:udId
export const endOrRenameAssignmentController = [
  validate(endOrRenameSchema),
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
