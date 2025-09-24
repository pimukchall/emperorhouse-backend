import { prisma } from "../prisma.js";
import { parsePaging, ilikeContains, toInt, pickSort } from "../services/query.util.js";

// GET /api/departments
export async function listDepartmentsController(req, res) {
  const { page, limit, skip, sort, sortBy } = parsePaging(req);
  const q = req.query.q ? String(req.query.q) : "";

  const where = q
    ? { OR: [{ code: ilikeContains(q) }, { nameTh: ilikeContains(q) }, { nameEn: ilikeContains(q) }] }
    : {};

  const sortField = pickSort(sortBy, ["id", "code", "nameTh", "nameEn", "createdAt"]);
  const [rows, total] = await Promise.all([
    prisma.department.findMany({ where, orderBy: { [sortField]: sort }, skip, take: limit }),
    prisma.department.count({ where }),
  ]);

  res.json({ ok: true, data: rows, meta: { page, pages: Math.max(1, Math.ceil(total / limit)), total } });
}

// GET /api/departments/:id
export async function getDepartmentController(req, res) {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });

  const d = await prisma.department.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ ok: false, error: "DEPARTMENT_NOT_FOUND" });
  res.json({ ok: true, data: d });
}

// POST /api/departments (upsert)
export async function upsertDepartmentController(req, res) {
  try {
    const { id, code, nameTh, nameEn } = req.body || {};
    if (!code || !nameTh) return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });

    let d;
    if (id) {
      d = await prisma.department.update({
        where: { id: Number(id) },
        data: { code, nameTh, nameEn: nameEn ?? null },
      });
    } else {
      d = await prisma.department.create({ data: { code, nameTh, nameEn: nameEn ?? null } });
    }
    res.json({ ok: true, data: d });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/P2025/.test(msg)) return res.status(404).json({ ok: false, error: "DEPARTMENT_NOT_FOUND" });
    if (/P2002/.test(msg)) return res.status(409).json({ ok: false, error: "DEPT_CODE_EXISTS" });
    res.status(400).json({ ok: false, error: msg });
  }
}

// DELETE /api/departments/:id
export async function deleteDepartmentController(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });
    await prisma.department.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/P2025/.test(msg)) return res.status(404).json({ ok: false, error: "DEPARTMENT_NOT_FOUND" });
    res.status(400).json({ ok: false, error: msg });
  }
}
