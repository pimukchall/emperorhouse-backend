import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  listOrganizationsService,
  getOrganizationService,
  createOrganizationService,
  updateOrganizationService,
  softDeleteOrganizationService,
  restoreOrganizationService,
  hardDeleteOrganizationService,
} from "../services/organizations.service.js";

const createSchema = z.object({
  code: z.string().trim().optional(), // ว่างได้ (เราจะแปลงเป็น null/undefined ที่ service)
  nameTh: z.string().trim().nullable().optional(),
  nameEn: z.string().trim().nullable().optional(),
});
const updateSchema = createSchema;

export const listOrganizationsController = [
  asyncHandler(async (req, res) => {
    const { page, limit, q, includeDeleted, sortBy, sort } = req.query;
    const out = await listOrganizationsService({
      page,
      limit,
      q,
      includeDeleted: includeDeleted === "1" || includeDeleted === "true",
      sortBy,
      sort,
    });
    res.json({
      ok: true,
      data: out.items ?? out.rows ?? out.data ?? out,
      meta: out.meta,
    });
  }),
];

export const getOrganizationController = [
  asyncHandler(async (req, res) => {
    const data = await getOrganizationService({ id: req.params.id });
    res.json({ ok: true, data });
  }),
];

export const createOrganizationController = [
  asyncHandler(async (req, res) => {
    const data = await createOrganizationService({
      data: createSchema.parse(req.body ?? {}),
    });
    res.status(201).json({ ok: true, data });
  }),
];

export const updateOrganizationController = [
  asyncHandler(async (req, res) => {
    const data = await updateOrganizationService({
      id: req.params.id,
      data: updateSchema.parse(req.body ?? {}),
    });
    res.json({ ok: true, data });
  }),
];

export const deleteOrganizationController = [
  asyncHandler(async (req, res) => {
    const hard = req.query.hard === "1" || req.query.hard === "true";
    const fn = hard
      ? hardDeleteOrganizationService
      : softDeleteOrganizationService;
    const data = await fn({ id: req.params.id });
    res.json({ ok: true, data });
  }),
];

export const restoreOrganizationController = [
  asyncHandler(async (req, res) => {
    const data = await restoreOrganizationService({ id: req.params.id });
    res.json({ ok: true, data });
  }),
];
