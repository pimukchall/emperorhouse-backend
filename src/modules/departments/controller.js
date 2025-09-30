import { z } from "zod";
import { asyncHandler } from "#utils/asyncHandler.js";
import {
  listDepartmentsService,
  getDepartmentService,
  upsertDepartmentService,
  deleteDepartmentService,
} from "./service.js";

const upsertSchema = z.object({
  id: z.number().int().positive().optional(),
  code: z.string().min(1),
  nameTh: z.string().min(1),
  nameEn: z.string().nullable().optional(),
});

export const listDepartmentsController = [
  asyncHandler(async (req, res) => {
    const { page, limit, sortBy, sort } = req.query;
    const out = await listDepartmentsService({ page, limit, sortBy, sort });
    res.json({
      ok: true,
      data: out.data ?? out.rows ?? out.items ?? out,
      meta: out.meta,
    });
  }),
];

export const getDepartmentController = [
  asyncHandler(async (req, res) => {
    const data = await getDepartmentService({ id: req.params.id });
    if (!data)
      return res.status(404).json({ ok: false, error: "DEPARTMENT_NOT_FOUND" });
    res.json({ ok: true, data });
  }),
];

export const upsertDepartmentController = [
  asyncHandler(async (req, res) => {
    const body = upsertSchema.parse(req.body ?? {});
    const data = await upsertDepartmentService({ body });
    res.json({ ok: true, data });
  }),
];

export const deleteDepartmentController = [
  asyncHandler(async (req, res) => {
    const data = await deleteDepartmentService({ id: req.params.id });
    res.json({ ok: true, data });
  }),
];
