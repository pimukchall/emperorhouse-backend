import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

export const router = Router();

// ---- helpers ----

const baseSelect = {
  id: true,
  code: true,
  nameTh: true,
  nameEn: true,
  createdAt: true,
  updatedAt: true,
};

// LIST: GET /api/departments?q=&page=&limit=&sortBy=&sort=
router.get('/', async (req, res) => {
  try {
    const {
      q,
      page = '1',
      limit = '50',
      sortBy = 'id',
      sort = 'asc',
    } = req.query;

    const where = q
      ? {
          OR: [
            { code: { contains: String(q), mode: 'insensitive' } },
            { nameTh: { contains: String(q), mode: 'insensitive' } },
            { nameEn: { contains: String(q), mode: 'insensitive' } },
          ],
        }
      : {};

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * take;

    const [total, items] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        select: baseSelect,
        orderBy: { [sortBy]: sort === 'desc' ? 'desc' : 'asc' },
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

// READ: GET /api/departments/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const dept = await prisma.department.findUnique({ where: { id }, select: baseSelect });
  if (!dept) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, data: dept });
});

// CREATE: POST /api/departments (admin-only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { code, nameTh = '', nameEn = '' } = req.body || {};
    if (!code) return res.status(400).json({ ok: false, error: 'code required' });

    const created = await prisma.department.create({
      data: { code, nameTh, nameEn },
      select: baseSelect,
    });
    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Department code already exists' });
    }
    res.status(400).json({ ok: false, error: e.message });
  }
});

// UPDATE: PATCH /api/departments/:id (admin-only)
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { code, nameTh, nameEn } = req.body || {};

    const data = {};
    if (code !== undefined) data.code = code;
    if (nameTh !== undefined) data.nameTh = nameTh;
    if (nameEn !== undefined) data.nameEn = nameEn;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: 'No updatable fields' });
    }

    const updated = await prisma.department.update({
      where: { id },
      data,
      select: baseSelect,
    });
    res.json({ ok: true, data: updated });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Department code already exists' });
    }
    res.status(400).json({ ok: false, error: e.message });
  }
});

// DELETE: DELETE /api/departments/:id (admin-only; block if in use)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const usage = await prisma.user.count({ where: { departmentId: id } });
    if (usage > 0) {
      return res.status(409).json({
        ok: false,
        error: `Cannot delete: ${usage} user(s) still reference this department`,
      });
    }

    await prisma.department.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});