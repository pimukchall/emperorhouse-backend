import { asyncHandler } from "#utils/asyncHandler.js";
import { buildListResponse } from "#utils/pagination.js";
import { AppError } from "#utils/appError.js";
import * as S from "./schema.js";
import {
  listDepartmentsService,
  getDepartmentService,
  upsertDepartmentService,
  deleteDepartmentService,
} from "./service.js";

export const listDepartmentsController = [
  asyncHandler(async (req, res) => {
    const q = S.DeptListQuery.parse(req.query);
    const out = await listDepartmentsService(q);
    res.json({
      ok: true,
      ...buildListResponse({
        rows: out.rows,
        total: out.total,
        page: out.page,
        limit: out.limit,
        sortBy: out.sortBy,
        sort: out.sort,
      }),
    });
  }),
];

export const getDepartmentController = [
  asyncHandler(async (req, res) => {
    const { id } = S.DeptParams.parse(req.params);
    const data = await getDepartmentService({ id });
    if (!data) throw AppError.notFound("DEPARTMENT_NOT_FOUND");
    res.json({ ok: true, data });
  }),
];

export const upsertDepartmentController = [
  asyncHandler(async (req, res) => {
    const body = S.DeptUpsert.parse(req.body ?? {});
    const data = await upsertDepartmentService({ body });
    res.json({ ok: true, data });
  }),
];

export const deleteDepartmentController = [
  asyncHandler(async (req, res) => {
    const { id } = S.DeptParams.parse(req.params);
    const data = await deleteDepartmentService({ id });
    res.json({ ok: true, data });
  }),
];
