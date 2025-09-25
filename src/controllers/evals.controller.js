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
} from "../services/eval.service.js";

const sendErr = (res, e, def = 400) =>
  res.status(e?.status || def).json({ ok: false, error: e?.message || "BAD_REQUEST" });

function currentUserId(req) {
  return Number(req.user?.id || req.userId || req.auth?.sub);
}

export async function listEvalsController(req, res) {
  try {
    const list = await listEvaluations({
      cycleId: req.query.cycleId ? Number(req.query.cycleId) : undefined,
      ownerId: req.query.ownerId ? Number(req.query.ownerId) : undefined,
      status: req.query.status,
    });
    res.json({ ok: true, data: list });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function getEvalController(req, res) {
  try {
    const row = await getEvaluation(Number(req.params.id));
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e, 404);
  }
}

export async function createEvalController(req, res) {
  try {
    const byUserId = currentUserId(req);
    const { cycleId, ownerId, managerId, mdId, type } = req.body || {};
    const row = await createEvaluation({
      cycleId: Number(cycleId),
      ownerId: Number(ownerId ?? byUserId),
      managerId: managerId ? Number(managerId) : null,
      mdId: mdId ? Number(mdId) : null,
      type: String(type || "OPERATIONAL").toUpperCase(),
      byUserId,
    });
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function updateEvalController(req, res) {
  try {
    const row = await updateEvaluation(Number(req.params.id), req.body, req.me.id);
    res.json({ ok: true, data: row });
  } catch (e) { sendErr(res, e); }
}

export async function submitEvalController(req, res) {
  try {
    const row = await submitEvaluation(Number(req.params.id), currentUserId(req));
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function approveManagerController(req, res) {
  try {
    const row = await approveByManager(Number(req.params.id), currentUserId(req), req.body?.comment);
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function approveMDController(req, res) {
  try {
    const row = await approveByMD(Number(req.params.id), currentUserId(req), req.body?.comment);
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function rejectEvalController(req, res) {
  try {
    const row = await rejectEvaluation(Number(req.params.id), currentUserId(req), req.body?.comment);
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function deleteEvalController(req, res) {
  try {
    const row = await deleteEvaluation(Number(req.params.id));
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function listEligibleController(req, res) {
  try {
    const cycleId = Number(req.params.cycleId || req.query.cycleId);
    if (!cycleId) return res.status(400).json({ ok: false, error: "CYCLE_ID_REQUIRED" });
    const arr = await listEligibleEvaluatees(cycleId, currentUserId(req));
    res.json({ ok: true, data: arr });
  } catch (e) {
    sendErr(res, e);
  }
}
