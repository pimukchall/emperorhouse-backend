import {
  listCyclesService,
  getCycleService,
  createCycleService,
  updateCycleService,
  deleteCycleService,
} from "../services/eval-cycles.service.js";

const sendErr = (res, e, def = 400) =>
  res.status(e?.status || def).json({ ok: false, error: e?.message || "BAD_REQUEST" });

export async function listCyclesController(req, res) {
  try {
    const out = await listCyclesService(req.query || {});
    res.json({ ok: true, data: out.items, meta: out.meta });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function getCycleController(req, res) {
  try {
    const row = await getCycleService(req.params.id);
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e, 404);
  }
}

export async function createCycleController(req, res) {
  try {
    const row = await createCycleService(req.body || {});
    res.status(201).json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function updateCycleController(req, res) {
  try {
    const row = await updateCycleService(req.params.id, req.body || {});
    res.json({ ok: true, data: row });
  } catch (e) {
    sendErr(res, e);
  }
}

export async function deleteCycleController(req, res) {
  try {
    const out = await deleteCycleService(req.params.id);
    res.json({ ok: true, data: out });
  } catch (e) {
    sendErr(res, e);
  }
}
