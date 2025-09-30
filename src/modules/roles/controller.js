import { z } from "zod";
import { asyncHandler } from "#utils/asyncHandler.js";
import {
  listRolesService,
  upsertRoleService,
  deleteRoleService,
  getRoleService,
} from "./service.js";

const upsertSchema = z.object({
  name: z.string().trim().min(1),
  labelTh: z.string().trim().nullable().optional(),
  labelEn: z.string().trim().nullable().optional(),
});

export const listRolesController = [
  asyncHandler(async (_req, res) => {
    const rows = await listRolesService();
    res.json({ ok: true, data: rows });
  }),
];

export const getRoleController = [
  asyncHandler(async (req, res) => {
    const data = await getRoleService({ id: req.params.id });
    if (!data)
      return res.status(404).json({ ok: false, error: "ROLE_NOT_FOUND" });
    res.json({ ok: true, data });
  }),
];

export const upsertRoleController = [
  asyncHandler(async (req, res) => {
    const body = upsertSchema.parse(req.body ?? {});
    const role = await upsertRoleService({ body });
    res.json({ ok: true, data: role });
  }),
];

export const deleteRoleController = [
  asyncHandler(async (req, res) => {
    const data = await deleteRoleService({
      id: req.params.id ?? req.params.name,
    });
    res.json({ ok: true, data });
  }),
];
