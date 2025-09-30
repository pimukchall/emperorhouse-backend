import { z } from "zod";
import { asyncHandler } from "#utils/asyncHandler.js";
import {
  createEvaluation,
  getEvaluation,
  updateEvaluation,
  submitEvaluation,
  approveByManager,
  approveByMD,
  rejectEvaluation,
  deleteEvaluation,
  listEvaluations,
  listEligibleEvaluatees,
} from "./service.js";

/* ---------- Schemas (เฉพาะที่เป็น input ตรง ๆ) ---------- */
const createSchema = z.object({
  cycleId: z.coerce.number().int().positive(),
  ownerId: z.coerce.number().int().positive().optional(), // ไม่ส่ง = me
  managerId: z.coerce.number().int().positive().nullable().optional(),
  mdId: z.coerce.number().int().positive().nullable().optional(),
  type: z.enum(["OPERATIONAL", "SUPERVISOR"]).optional(),
});
const updateSchema = z.record(z.any());
const signSchema = z.object({
  signature: z.string().min(16),
  comment: z.string().trim().nullable().optional(),
});

const meId = (req) => req?.me?.id;

/* ---------- LIST / GET ---------- */
export const listEvalsController = [
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.cycleId) where.cycleId = Number(req.query.cycleId);
    if (req.query.owner === "me") where.ownerId = meId(req);
    if (req.query.ownerId) where.ownerId = Number(req.query.ownerId);
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    const rows = await listEvaluations(where);
    res.json({ ok: true, data: rows });
  }),
];

export const getEvalController = [
  asyncHandler(async (req, res) => {
    const row = await getEvaluation(Number(req.params.id));
    res.json({ ok: true, data: row });
  }),
];

/* ---------- CREATE / UPDATE / DELETE ---------- */
export const createEvalController = [
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body || {});
    const row = await createEvaluation({
      ...body,
      ownerId: body.ownerId ?? meId(req),
      byUserId: meId(req),
    });
    res.status(201).json({ ok: true, data: row });
  }),
];

export const updateEvalController = [
  asyncHandler(async (req, res) => {
    const row = await updateEvaluation(
      Number(req.params.id),
      updateSchema.parse(req.body || {}),
      meId(req)
    );
    res.json({ ok: true, data: row });
  }),
];

export const deleteEvalController = [
  asyncHandler(async (req, res) => {
    const row = await deleteEvaluation(Number(req.params.id));
    res.json({ ok: true, data: row });
  }),
];

/* ---------- FLOW (submit/approve/reject) ---------- */
export const submitEvalController = [
  asyncHandler(async (req, res) => {
    const row = await submitEvaluation(
      Number(req.params.id),
      meId(req),
      signSchema.parse(req.body || {})
    );
    res.json({ ok: true, data: row });
  }),
];

export const approveManagerController = [
  asyncHandler(async (req, res) => {
    const row = await approveByManager(
      Number(req.params.id),
      meId(req),
      signSchema.parse(req.body || {})
    );
    res.json({ ok: true, data: row });
  }),
];

export const approveMDController = [
  asyncHandler(async (req, res) => {
    const row = await approveByMD(
      Number(req.params.id),
      meId(req),
      signSchema.parse(req.body || {})
    );
    res.json({ ok: true, data: row });
  }),
];

export const rejectEvalController = [
  asyncHandler(async (req, res) => {
    const comment = String(req.body?.comment || "");
    const row = await rejectEvaluation(
      Number(req.params.id),
      meId(req),
      comment
    );
    res.json({ ok: true, data: row });
  }),
];

/* ---------- Eligible list ---------- */
export const listEligibleController = [
  asyncHandler(async (req, res) => {
    const cycleId = Number(req.params.cycleId || req.query.cycleId);
    if (!cycleId)
      return res.status(400).json({ ok: false, error: "CYCLE_ID_REQUIRED" });

    const includeSelf = ["1", "true"].includes(
      String(req.query.includeSelf || "").toLowerCase()
    );
    const includeTaken = ["1", "true"].includes(
      String(req.query.includeTaken || "").toLowerCase()
    );

    const arr = await listEligibleEvaluatees(cycleId, meId(req), {
      includeSelf,
      includeTaken,
    });
    res.json({ ok: true, data: arr });
  }),
];
