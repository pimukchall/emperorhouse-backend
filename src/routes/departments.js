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
      { code: { contains: s } },
      { nameTh: { contains: s } },
      { nameEn: { contains: s } },
    ],
  };
}

// LIST
router.get("/", async (req, res) => {
  try {
    const {
      q,
      page = "1",
      limit = "20",
      sortBy = "id",
      sort = "asc",
    } = req.query;
    const where = buildWhere({ q });

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
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
      meta: {
        page: pageNum,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// CREATE
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { code, nameTh, nameEn } = req.body || {};
    if (!code || !nameTh || !nameEn) {
      return res
        .status(400)
        .json({ ok: false, error: "code, nameTh, nameEn required" });
    }
    const d = await prisma.department.create({
      data: { code, nameTh, nameEn },
    });
    res.status(201).json({ ok: true, data: d });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// UPDATE
router.patch("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { code, nameTh, nameEn } = req.body || {};
    const d = await prisma.department.update({
      where: { id },
      data: {
        ...(code ? { code } : {}),
        ...(nameTh ? { nameTh } : {}),
        ...(nameEn ? { nameEn } : {}),
      },
    });
    res.json({ ok: true, data: d });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// DELETE
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const target = await prisma.department.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    // เช็คการใช้งานใน UserDepartment (active เท่านั้น)
    const inUse = await prisma.userDepartment.count({
      where: { departmentId: id, endedAt: null },
    });
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
