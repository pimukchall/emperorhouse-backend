import { asyncHandler } from "#utils/asyncHandler.js";
import { AppError } from "#utils/appError.js";
import { buildListResponse } from "#utils/pagination.js";
import * as S from "./schema.js";
import {
  listOrganizationsService,
  getOrganizationService,
  createOrganizationService,
  updateOrganizationService,
  softDeleteOrganizationService,
  restoreOrganizationService,
  hardDeleteOrganizationService,
} from "./service.js";

export const listOrganizationsController = [
  asyncHandler(async (req, res) => {
    const q = S.OrgListQuery.parse(req.query);
    const out = await listOrganizationsService(q);
    res.json({
      ok: true,
      ...buildListResponse({
        rows: out.rows,
        total: out.total,
        page: out.page ?? q.page,
        limit: out.limit ?? q.limit,
        sortBy: out.sortBy ?? q.sortBy,
        sort: out.sort ?? q.sort,
      }),
    });
  }),
];

export const getOrganizationController = [
  asyncHandler(async (req, res) => {
    const { id } = S.OrgParams.parse(req.params);
    const data = await getOrganizationService({ id });
    if (!data) throw AppError.notFound("ORGANIZATION_NOT_FOUND");
    res.json({ ok: true, data });
  }),
];

export const createOrganizationController = [
  asyncHandler(async (req, res) => {
    const body = S.OrgCreate.parse(req.body ?? {});
    const data = await createOrganizationService({ data: body });
    res.status(201).json({ ok: true, data });
  }),
];

export const updateOrganizationController = [
  asyncHandler(async (req, res) => {
    const { id } = S.OrgParams.parse(req.params);
    const body = S.OrgUpdate.parse(req.body ?? {});
    const data = await updateOrganizationService({ id, data: body });
    res.json({ ok: true, data });
  }),
];

export const deleteOrganizationController = [
  asyncHandler(async (req, res) => {
    const { id } = S.OrgParams.parse(req.params);
    const { hard } = S.OrgDeleteQuery.parse(req.query);
    const fn = hard ? hardDeleteOrganizationService : softDeleteOrganizationService;
    const data = await fn({ id });
    res.json({ ok: true, data });
  }),
];

export const restoreOrganizationController = [
  asyncHandler(async (req, res) => {
    const { id } = S.OrgParams.parse(req.params);
    const data = await restoreOrganizationService({ id });
    res.json({ ok: true, data });
  }),
];
