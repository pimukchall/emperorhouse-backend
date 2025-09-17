import { Router } from 'express';
import { prisma } from '../prisma.js';

export const router = Router();

// GET /api/users
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true, email: true,
      firstNameTh: true, lastNameTh: true,
      firstNameEn: true, lastNameEn: true,
      role: { select: { name: true, labelTh: true, labelEn: true } },
      department: { select: { code: true, nameTh: true, nameEn: true } },
      createdAt: true, updatedAt: true
    },
    orderBy: { id: 'asc' }
  });
  res.json({ ok: true, data: users });
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { role: true, department: true }
  });
  if (!user) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, data: user });
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const {
      email, passwordHash,
      firstNameTh, lastNameTh, firstNameEn, lastNameEn,
      roleId, departmentId
    } = req.body;

    const created = await prisma.user.create({
      data: {
        email, passwordHash,
        firstNameTh, lastNameTh, firstNameEn, lastNameEn,
        roleId, departmentId
      }
    });
    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});
