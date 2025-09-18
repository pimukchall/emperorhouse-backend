import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireRole } from "../middlewares/auth.js";

export const router = Router();

// helpers
const toInt = (v) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

function buildWhere({ q }) {
  if (!q) return {};
  const s = String(q);
  return {
    OR: [
      { name: { contains: s } },
      { labelTh: { contains: s } },
      { labelEn: { contains: s } },
    ],
  };
}

/**
 * GET /roles
 * - แสดงรายการ role (admin เท่านั้น หรือจะเปิด requireAuth ก็ได้ตามนโยบาย)
 */
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    const {
      q,
      page = "1",
      limit = "50",
      sortBy = "id",
      sort = "asc",
    } = req.query;

    const where = buildWhere({ q });
    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * take;

    const [total, items] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        orderBy: { [sortBy]: sort === "desc" ? "desc" : "asc" },
        skip,
        take,
      }),
    ]);

    res.json({
      ok: true,
      data: items,
      meta: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * POST /roles
 * - admin เท่านั้น
 * body: { name, labelTh?, labelEn? }
 * - name ควรเป็น slug/ตัวพิมพ์เล็ก เช่น "admin", "hr.manager"
 */
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    let { name, labelTh, labelEn } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: "name required" });

    name = String(name).trim();
    // ห้ามซ้ำ
    const exist = await prisma.role.findUnique({ where: { name } });
    if (exist) return res.status(409).json({ ok: false, error: "name already exists" });

    const created = await prisma.role.create({
      data: {
        name,
        labelTh: String(labelTh || "").trim(),
        labelEn: String(labelEn || "").trim(),
      },
    });

    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * PATCH /roles/:id
 * - admin เท่านั้น
 * - ถ้าแก้ name → เช็ค unique
 */
router.patch("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    let { name, labelTh, labelEn } = req.body || {};

    const target = await prisma.role.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    if (name && name !== target.name) {
      name = String(name).trim();
      const dup = await prisma.role.findUnique({ where: { name } });
      if (dup) return res.status(409).json({ ok: false, error: "name already exists" });
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(labelTh !== undefined ? { labelTh: String(labelTh || "").trim() } : {}),
        ...(labelEn !== undefined ? { labelEn: String(labelEn || "").trim() } : {}),
      },
    });

    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * DELETE /roles/:id
 * - admin เท่านั้น
 * - กันลบถ้ามีผู้ใช้ยังอ้างอิง role นี้อยู่
 */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const target = await prisma.role.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    const inUse = await prisma.user.count({ where: { roleId: id } });
    if (inUse > 0) {
      return res.status(400).json({
        ok: false,
        error: "Cannot delete: role is referenced by users",
        refCount: inUse,
      });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ ok: true, deleted: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;
