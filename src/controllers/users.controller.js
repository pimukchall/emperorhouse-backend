import { prisma } from "../prisma.js";
import {
  listUsersService,
  getUserService,
  createUserService,
  updateUserService,
  softDeleteUserService,
  restoreUserService,
  setPrimaryDepartmentService,
} from "../services/users.service.js";

/* ----------------------------- Helpers ----------------------------- */
function bool(v, def = false) {
  if (v === undefined || v === null) return def;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}
function sendError(res, e, fallback = 400) {
  const msg = e?.message || "UNKNOWN_ERROR";
  const status =
    e?.status ??
    (msg === "USER_NOT_FOUND"
      ? 404
      : msg === "DUPLICATE_EMPLOYEE_CODE"
      ? 409
      : fallback);
  return res.status(status).json({ ok: false, error: msg });
}

/* ----------------------------- Controllers ----------------------------- */

// GET /api/users
export async function listUsersController(req, res) {
  try {
    const { page, limit, q, includeDeleted, roleId, departmentId, sortBy, sort } = req.query;
    const result = await listUsersService({
      prisma,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      q: q ?? "",
      includeDeleted: bool(includeDeleted, false),
      roleId: roleId ?? "",
      departmentId: departmentId ?? "",
      sortBy: sortBy ?? "id",
      sort: sort ?? "asc",
    });
    return res.json({ ok: true, data: result.data, meta: result.meta });
  } catch (e) {
    return sendError(res, e);
  }
}

// GET /api/users/:id
export async function getUserController(req, res) {
  try {
    const { id } = req.params;
    const data = await getUserService({ prisma, id });
    return res.json({ ok: true, data });
  } catch (e) {
    return sendError(res, e);
  }
}

// POST /api/users
export async function createUserController(req, res) {
  try {
    const data = req.body || {};
    const created = await createUserService({ prisma, data });
    return res.status(201).json({ ok: true, data: created });
  } catch (e) {
    return sendError(res, e);
  }
}

// PATCH /api/users/:id
export async function updateUserController(req, res) {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const updated = await updateUserService({ prisma, id, data });
    return res.json({ ok: true, data: updated });
  } catch (e) {
    return sendError(res, e);
  }
}

// DELETE /api/users/:id   (soft by default; use ?hard=1 for hard delete)
export async function softDeleteUserController(req, res) {
  try {
    const { id } = req.params;
    const hard = bool(req.query?.hard, false);
    const deleted = await softDeleteUserService({ prisma, id, hard });
    return res.json({ ok: true, data: deleted });
  } catch (e) {
    return sendError(res, e);
  }
}

// POST /api/users/:id/restore
export async function restoreUserController(req, res) {
  try {
    const { id } = req.params;
    const data = await restoreUserService({ prisma, id });
    return res.json({ ok: true, data });
  } catch (e) {
    return sendError(res, e);
  }
}

// POST /api/users/:id/primary-department
// body: { departmentId: number }
export async function setPrimaryDepartmentController(req, res) {
  try {
    const { id } = req.params;
    const { departmentId } = req.body || {};
    if (!departmentId) {
      return res.status(400).json({ ok: false, error: "departmentId required" });
    }
    const data = await setPrimaryDepartmentService({
      prisma,
      userId: Number(id),
      departmentId: Number(departmentId),
    });
    return res.json({ ok: true, data });
  } catch (e) {
    return sendError(res, e);
  }
}
