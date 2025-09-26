import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  listCyclesService,
  getCycleService,
  createCycleService,
  updateCycleService,
  deleteCycleService,
} from "../services/eval-cycles.service.js";

/* ---------- Schemas ---------- */
const createSchema = z.object({
  code: z.string().trim().min(1),
  year: z.coerce.number().int().min(2000),
  stage: z.enum(["MID_YEAR", "YEAR_END"]),
  openAt: z.coerce.date(),
  closeAt: z.coerce.date(),
  isActive: z.coerce.boolean().optional(),
  isMandatory: z.coerce.boolean().optional(),
});
const updateSchema = createSchema.partial();

/* ---------- Controllers ---------- */

// GET /api/eval-cycles
export const listCyclesController = [
  asyncHandler(async (req, res) => {
    const out = await listCyclesService(req.query || {});
    res.json({ ok: true, data: out.items, meta: out.meta });
  }),
];

// GET /api/eval-cycles/:id
export const getCycleController = [
  asyncHandler(async (req, res) => {
    const row = await getCycleService(req.params.id);
    res.json({ ok: true, data: row });
  }),
];

// POST /api/eval-cycles
export const createCycleController = [
  asyncHandler(async (req, res) => {
    const row = await createCycleService(createSchema.parse(req.body ?? {}));
    res.status(201).json({ ok: true, data: row });
  }),
];

// PATCH /api/eval-cycles/:id
export const updateCycleController = [
  asyncHandler(async (req, res) => {
    const row = await updateCycleService(
      req.params.id,
      updateSchema.parse(req.body ?? {})
    );
    res.json({ ok: true, data: row });
  }),
];

// DELETE /api/eval-cycles/:id
export const deleteCycleController = [
  asyncHandler(async (req, res) => {
    const out = await deleteCycleService(req.params.id);
    res.json({ ok: true, data: out });
  }),
];
