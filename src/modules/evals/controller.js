import { asyncHandler } from "#utils/asyncHandler.js";
import * as S from "./schema.js";
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

const meId = (req) => Number(req?.me?.id || req?.user?.id || req?.auth?.sub);

/* ---------- LIST / GET ---------- */
export const listEvalsController = [
  asyncHandler(async (req, res) => {
    const q = S.ListQuery.parse(req.query);
    const where = {
      ...(q.cycleId ? { cycleId: q.cycleId } : {}),
      ...(q.owner === "me" ? { ownerId: meId(req) } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const rows = await listEvaluations(where);
    res.json({ ok: true, data: rows });
  }),
];

export const getEvalController = [
  asyncHandler(async (req, res) => {
    const { id } = S.IdParam.parse(req.params);
    const row = await getEvaluation(id);
    res.json({ ok: true, data: row });
  }),
];

/* ---------- CREATE / UPDATE / DELETE ---------- */
export const createEvalController = [
  asyncHandler(async (req, res) => {
    const body = S.Create.parse(req.body ?? {});
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
    const { id } = S.IdParam.parse(req.params);
    const patch = S.Update.parse(req.body ?? {});
    const row = await updateEvaluation(id, patch, meId(req));
    res.json({ ok: true, data: row });
  }),
];

export const deleteEvalController = [
  asyncHandler(async (req, res) => {
    const { id } = S.IdParam.parse(req.params);
    const row = await deleteEvaluation(id);
    res.json({ ok: true, data: row });
  }),
];

/* ---------- FLOW (submit/approve/reject) ---------- */
export const submitEvalController = [
  asyncHandler(async (req, res) => {
    const { id } = S.IdParam.parse(req.params);
    const body = S.SignBody.parse(req.body ?? {});
    const row = await submitEvaluation(id, meId(req), body);
    res.json({ ok: true, data: row });
  }),
];

export const approveManagerController = [
  asyncHandler(async (req, res) => {
    const { id } = S.IdParam.parse(req.params);
    const body = S.SignBody.parse(req.body ?? {});
    const row = await approveByManager(id, meId(req), body);
    res.json({ ok: true, data: row });
  }),
];

export const approveMDController = [
  asyncHandler(async (req, res) => {
    const { id } = S.IdParam.parse(req.params);
    const body = S.SignBody.parse(req.body ?? {});
    const row = await approveByMD(id, meId(req), body);
    res.json({ ok: true, data: row });
  }),
];

export const rejectEvalController = [
  asyncHandler(async (req, res) => {
    const { id } = S.IdParam.parse(req.params);
    const comment = String(req.body?.comment || "");
    const row = await rejectEvaluation(id, meId(req), comment);
    res.json({ ok: true, data: row });
  }),
];

/* ---------- Eligible list ---------- */
export const listEligibleController = [
  asyncHandler(async (req, res) => {
    const { cycleId } = S.CycleParam.parse(req.params);
    const includeSelf = ["1","true"].includes(String(req.query.includeSelf || "").toLowerCase());
    const includeTaken = ["1","true"].includes(String(req.query.includeTaken || "").toLowerCase());
    const arr = await listEligibleEvaluatees(cycleId, meId(req), { includeSelf, includeTaken });
    res.json({ ok: true, data: arr });
  }),
];
