import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireRole } from "../middlewares/auth.js";

export const router = Router();

// helpers

function buildWhere({ q }) {
  if (!q) return {};
  const s = String(q);
  return {
    OR: [
      { code: { contains: s, mode: "insensitive" } },
      { nameTh: { contains: s, mode: "insensitive" } },
      { nameEn: { contains: s, mode: "insensitive" } },
    ],
  };
}

/**
 * GET /departments
 * - เฉพาะผู้ล็อกอิน
 * - รองรับ q, page, limit, sortBy, sort
 */
router.get("/", async (req, res) => {
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
      prisma.department.count({ where }),
      prisma.department.findMany({
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
 * POST /departments
 * - admin เท่านั้น
 * body: { code, nameTh, nameEn }
 */
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { code, nameTh, nameEn } = req.body || {};
    if (!code) return res.status(400).json({ ok: false, error: "code required" });

    // unique code
    const exist = await prisma.department.findUnique({ where: { code } });
    if (exist) return res.status(409).json({ ok: false, error: "code already exists" });

    const created = await prisma.department.create({
      data: {
        code: String(code).trim(),
        nameTh: String(nameTh || "").trim(),
        nameEn: String(nameEn || "").trim(),
      },
    });

    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * PATCH /departments/:id
 * - admin เท่านั้น
 */
router.patch("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { code, nameTh, nameEn } = req.body || {};

    const target = await prisma.department.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    // ถ้าแก้ code → เช็คซ้ำ
    if (code && code !== target.code) {
      const dup = await prisma.department.findUnique({ where: { code } });
      if (dup) return res.status(409).json({ ok: false, error: "code already exists" });
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(code !== undefined ? { code: String(code).trim() } : {}),
        ...(nameTh !== undefined ? { nameTh: String(nameTh || "").trim() } : {}),
        ...(nameEn !== undefined ? { nameEn: String(nameEn || "").trim() } : {}),
      },
    });

    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * DELETE /departments/:id
 * - admin เท่านั้น
 * - กันลบถ้ายังมีผู้ใช้งานอ้างอิง
 */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const target = await prisma.department.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    const inUse = await prisma.user.count({ where: { departmentId: id } });
    if (inUse > 0) {
      return res.status(400).json({
        ok: false,
        error: "Cannot delete: department is referenced by users",
        refCount: inUse,
      });
    }

    await prisma.department.delete({ where: { id } });
    res.json({ ok: true, deleted: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;
