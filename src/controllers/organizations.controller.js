import {
  listOrganizationsService,
  getOrganizationService,
  createOrganizationService,
  updateOrganizationService,
  softDeleteOrganizationService,
  restoreOrganizationService,
  hardDeleteOrganizationService,
} from "../services/organizations.service.js";

export async function listOrganizationsController(req, res) {
  try {
    const { page, limit, q, includeDeleted, sortBy, sort } = req.query;
    const out = await listOrganizationsService({
      page,
      limit,
      q,
      includeDeleted: includeDeleted === "1" || includeDeleted === "true",
      sortBy,
      sort,
    });
    res.json({ ok: true, data: out.items, meta: out.meta });
  } catch (e) {
    res.status(e.status || 400).json({ ok: false, error: e.message || String(e) });
  }
}

export async function getOrganizationController(req, res) {
  try {
    const data = await getOrganizationService({ id: req.params.id });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(e.status || 400).json({ ok: false, error: e.message || String(e) });
  }
}

export async function createOrganizationController(req, res) {
  try {
    const data = await createOrganizationService({ data: req.body || {} });
    res.status(201).json({ ok: true, data });
  } catch (e) {
    res.status(e.status || 400).json({ ok: false, error: e.message || String(e) });
  }
}

export async function updateOrganizationController(req, res) {
  try {
    const data = await updateOrganizationService({ id: req.params.id, data: req.body || {} });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(e.status || 400).json({ ok: false, error: e.message || String(e) });
  }
}

export async function deleteOrganizationController(req, res) {
  try {
    const hard = req.query.hard === "1" || req.query.hard === "true";
    const fn = hard ? hardDeleteOrganizationService : softDeleteOrganizationService;
    const data = await fn({ id: req.params.id });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(e.status || 400).json({ ok: false, error: e.message || String(e) });
  }
}

export async function restoreOrganizationController(req, res) {
  try {
    const data = await restoreOrganizationService({ id: req.params.id });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(e.status || 400).json({ ok: false, error: e.message || String(e) });
  }
}
