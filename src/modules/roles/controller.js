import { asyncHandler } from "#utils/asyncHandler.js";
import {
  listRolesService,
  upsertRoleService,
  deleteRoleService,
  getRoleService,
} from "./service.js";
import { AppError } from "#utils/appError.js";

export const listRolesController = [
  asyncHandler(async (_req, res) => {
    const rows = await listRolesService();
    res.json({ ok: true, data: rows });
  }),
];

export const getRoleController = [
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = await getRoleService({ id });
    if (!data) throw AppError.notFound("ROLE_NOT_FOUND");
    res.json({ ok: true, data });
  }),
];

export const upsertRoleController = [
  asyncHandler(async (req, res) => {
    const role = await upsertRoleService({ body: req.body }); // body validated แล้ว
    res.json({ ok: true, data: role });
  }),
];

export const deleteRoleController = [
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = await deleteRoleService({ id });
    res.json({ ok: true, data });
  }),
];
