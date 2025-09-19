import { prisma } from "../prisma.js";
import {
  listUsersService,
  getUserService,
  createUserService,
  updateUserService,
  softDeleteUserService,
  setPrimaryDepartmentService,
  restoreUserService,
} from "../services/users.service.js";

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/users
export async function listUsersController(req, res) {
  try {
    const page = toInt(req.query.page) || 1;
    const limit = toInt(req.query.limit) || 20;
    const q = (req.query.q || "").toString();
    const roleId = toInt(req.query.roleId) || undefined;
    const departmentId = toInt(req.query.departmentId) || undefined;
    const includeDeleted = String(req.query.includeDeleted || "") === "1";
    const sortBy = (req.query.sortBy || "id").toString();
    const sort = (req.query.sort || "desc").toString();

    const { data, total } = await listUsersService({
      prisma,
      q,
      page,
      pageSize: limit,
      sortBy,
      sort,
      roleId,
      departmentId,
      includeDeleted,
    });

    res.json({
      ok: true,
      data,
      meta: { page, pages: Math.max(1, Math.ceil(total / limit)), total },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
}

// GET /api/users/:id
export async function getUserController(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });
    const u = await getUserService({ prisma, id });
    if (!u) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    res.json({ ok: true, data: u });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
}

// POST /api/users
export async function createUserController(req, res) {
  try {
    const created = await createUserService({ prisma, data: req.body || {} });
    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/EMPLOYEE_CODE_EXISTS/.test(msg)) {
      return res.status(409).json({ ok: false, error: "EMPLOYEE_CODE_EXISTS" });
    }
    if (/unique/i.test(msg) || /P2002/.test(msg)) {
      return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
    }
    res.status(400).json({ ok: false, error: msg });
  }
}

// PATCH /api/users/:id
export async function updateUserController(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });
    const updated = await updateUserService({ prisma, id, data: req.body || {} });
    res.json({ ok: true, data: updated });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/EMPLOYEE_CODE_EXISTS/.test(msg)) {
      return res.status(409).json({ ok: false, error: "EMPLOYEE_CODE_EXISTS" });
    }
    if (/P2025/.test(msg)) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    if (/unique/i.test(msg) || /P2002/.test(msg)) {
      return res.status(409).json({ ok: false, error: "EMAIL_EXISTS" });
    }
    res.status(400).json({ ok: false, error: msg });
  }
}

// DELETE /api/users/:id?hard=1
export async function softDeleteUserController(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const hard = String(req.query.hard || "") === "1";
    if (hard) {
      await prisma.userDepartment.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
    } else {
      await softDeleteUserService({ prisma, id });
    }
    res.json({ ok: true });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/P2025/.test(msg)) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    res.status(400).json({ ok: false, error: msg });
  }
}

// POST /api/users/:id/primary/:udId
export async function setPrimaryDepartmentController(req, res) {
  try {
    const id = toInt(req.params.id);
    const udId = toInt(req.params.udId);
    if (!id || !udId) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const u = await setPrimaryDepartmentService({ prisma, id, udId });
    res.json({ ok: true, data: u });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/invalid udId/i.test(msg) || /P2025/.test(msg)) {
      return res.status(404).json({ ok: false, error: "USER_OR_ASSIGNMENT_NOT_FOUND" });
    }
    res.status(400).json({ ok: false, error: msg });
  }
}

// ✅ POST /api/users/:id/restore
export async function restoreUserController(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });
    await restoreUserService({ prisma, id });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
}
