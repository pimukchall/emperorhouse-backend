import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

export const router = Router();

// ---- helpers ----
const toInt = (v) =>
  v === undefined || v === null || v === '' ? undefined : Number(v);
const parseBool = (v) => v === '1' || v === 'true' || v === true;

const baseSelect = {
  id: true,
  name: true,
  labelTh: true,
  labelEn: true,
  createdAt: true,
  updatedAt: true,
};

// LIST: GET /api/roles?q=&page=&limit=&sortBy=&sort=
router.get('/', requireAuth, async (req, res) => {
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
            { name: { contains: String(q), mode: 'insensitive' } },
            { labelTh: { contains: String(q), mode: 'insensitive' } },
            { labelEn: { contains: String(q), mode: 'insensitive' } },
          ],
        }
      : {};

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (pageNum - 1) * take;

    const [total, items] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
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

// READ: GET /api/roles/:id
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const role = await prisma.role.findUnique({ where: { id }, select: baseSelect });
  if (!role) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, data: role });
});

// CREATE: POST /api/roles (admin-only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, labelTh = '', labelEn = '' } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'name required' });

    const created = await prisma.role.create({
      data: { name, labelTh, labelEn },
      select: baseSelect,
    });
    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Role name already exists' });
    }
    res.status(400).json({ ok: false, error: e.message });
  }
});

// UPDATE: PATCH /api/roles/:id (admin-only)
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, labelTh, labelEn } = req.body || {};

    const data = {};
    if (name !== undefined) data.name = name;
    if (labelTh !== undefined) data.labelTh = labelTh;
    if (labelEn !== undefined) data.labelEn = labelEn;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: 'No updatable fields' });
    }

    const updated = await prisma.role.update({
      where: { id },
      data,
      select: baseSelect,
    });
    res.json({ ok: true, data: updated });
  } catch (e) {
    if (e.code === 'P2002') {
      return res.status(409).json({ ok: false, error: 'Role name already exists' });
    }
    res.status(400).json({ ok: false, error: e.message });
  }
});

// DELETE: DELETE /api/roles/:id (admin-only; block if in use)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const usage = await prisma.user.count({ where: { roleId: id } });
    if (usage > 0) {
      return res.status(409).json({
        ok: false,
        error: `Cannot delete: ${usage} user(s) still reference this role`,
      });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});