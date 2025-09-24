import { parsePaging, ilikeContains, pickSort } from "../services/query.util.js";
import { prisma } from "../prisma.js";

// GET /api/roles
export async function listRolesController(req, res) {
  const { page, limit, skip, sort, sortBy } = parsePaging(req);
  const q = req.query.q ? String(req.query.q) : "";

  const where = q
    ? { OR: [{ name: ilikeContains(q) }, { labelTh: ilikeContains(q) }, { labelEn: ilikeContains(q) }] }
    : {};

  const sortField = pickSort(sortBy, ["id", "name", "labelTh", "labelEn", "createdAt"]);
  const [rows, total] = await Promise.all([
    prisma.role.findMany({ where, orderBy: { [sortField]: sort }, skip, take: limit }),
    prisma.role.count({ where }),
  ]);

  res.json({ ok: true, data: rows, meta: { page, pages: Math.max(1, Math.ceil(total / limit)), total } });
}

// POST /api/roles  (upsert by name)
export async function upsertRoleController(req, res) {
  try {
    const { name, labelTh, labelEn } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "NAME_REQUIRED" });

    const role = await prisma.role.upsert({
      where: { name },
      update: { labelTh: labelTh ?? null, labelEn: labelEn ?? null },
      create: { name, labelTh: labelTh ?? null, labelEn: labelEn ?? null },
    });
    res.json({ ok: true, data: role });
  } catch (e) {
    const msg = String(e?.message || e);
    return res.status(400).json({ ok: false, error: msg });
  }
}

// DELETE /api/roles/:name
export async function deleteRoleController(req, res) {
  try {
    const name = req.params.name;
    if (!name) return res.status(400).json({ ok: false, error: "NAME_REQUIRED" });

    if (["admin", "user"].includes(name.toLowerCase())) {
      return res.status(409).json({ ok: false, error: "BUILTIN_ROLE" });
    }

    await prisma.role.delete({ where: { name } });
    res.json({ ok: true });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/P2025/.test(msg)) return res.status(404).json({ ok: false, error: "ROLE_NOT_FOUND" });
    res.status(400).json({ ok: false, error: msg });
  }
}
