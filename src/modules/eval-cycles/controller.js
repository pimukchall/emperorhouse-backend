import { asyncHandler } from "#utils/asyncHandler.js";
import { buildListResponse } from "#utils/pagination.js";
import * as S from "./schema.js";
import {
  listCyclesService,
  getCycleService,
  createCycleService,
  updateCycleService,
  deleteCycleService,
} from "./service.js";

export const listCyclesController = [
  asyncHandler(async (req, res) => {
    const q = S.CycleListQuery.parse(req.query);
    const out = await listCyclesService(q);
    res.json({ ok: true, ...buildListResponse(out) });
  }),
];

export const getCycleController = [
  asyncHandler(async (req, res) => {
    const { id } = S.CycleParams.parse(req.params);
    const row = await getCycleService({ id });
    res.json({ ok: true, data: row });
  }),
];

export const createCycleController = [
  asyncHandler(async (req, res) => {
    const data = S.CycleCreate.parse(req.body ?? {});
    const row = await createCycleService({ data });
    res.status(201).json({ ok: true, data: row });
  }),
];

export const updateCycleController = [
  asyncHandler(async (req, res) => {
    const { id } = S.CycleParams.parse(req.params);
    const data = S.CycleUpdate.parse(req.body ?? {});
    const row = await updateCycleService({ id, data });
    res.json({ ok: true, data: row });
  }),
];

export const deleteCycleController = [
  asyncHandler(async (req, res) => {
    const { id } = S.CycleParams.parse(req.params);
    const out = await deleteCycleService({ id });
    res.json({ ok: true, data: out });
  }),
];
