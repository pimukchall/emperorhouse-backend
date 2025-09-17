// src/routes/users.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

export const router = Router();

// ---------- helpers ----------
const toInt = (v) =>
  v === undefined || v === null || v === '' ? undefined : Number(v);
const parseBool = (v) => v === '1' || v === 'true' || v === true;

const baseSelect = {
  id: true,
  email: true,
  firstNameTh: true,
  lastNameTh: true,
  firstNameEn: true,
  lastNameEn: true,
  avatarPath: true,
  role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
  department: {
    select: { id: true, code: true, nameTh: true, nameEn: true },
  },
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

// ---------- LIST: GET /api/users ----------
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      q,
      roleId,
      departmentId,
      includeDeleted,
      page = '1',
      limit = '20',
      sortBy = 'id',
      sort = 'asc',
    } = req.query;

    const where = {
      ...(parseBool(includeDeleted) ? {} : { deletedAt: null }),
      ...(toInt(roleId) ? { roleId: toInt(roleId) } : {}),
      ...(toInt(departmentId) ? { departmentId: toInt(departmentId) } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: String(q), mode: 'insensitive' } },
              { firstNameTh: { contains: String(q), mode: 'insensitive' } },
              { lastNameTh: { contains: String(q), mode: 'insensitive' } },
              { firstNameEn: { contains: String(q), mode: 'insensitive' } },
              { lastNameEn: { contains: String(q), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * take;

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
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

// ---------- READ: GET /api/users/:id ----------
router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const includeDeleted = parseBool(req.query.includeDeleted);
  const me = req.session.user;

  const user = await prisma.user.findFirst({
    where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
    select: baseSelect,
  });
  if (!user) return res.status(404).json({ ok: false, error: 'Not found' });

  // ถ้าไม่ใช่ admin และ user ถูกลบแบบ soft → ซ่อนไว้
  if (!includeDeleted && user.deletedAt && me.roleName !== 'admin') {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  res.json({ ok: true, data: user });
});

// ---------- CREATE (admin-only): POST /api/users ----------
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const {
      email,
      password,
      passwordHash: rawHash,
      firstNameTh,
      lastNameTh,
      firstNameEn,
      lastNameEn,
      roleId,
      departmentId,
    } = req.body;

    if (!email || !roleId || !departmentId) {
      return res
        .status(400)
        .json({ ok: false, error: 'email, roleId, departmentId required' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists && !exists.deletedAt) {
      return res.status(409).json({ ok: false, error: 'Email already in use' });
    }

    let passwordHash = rawHash || null;
    if (!passwordHash && password) {
      passwordHash = await bcrypt.hash(password, 10);
    }
    if (!passwordHash) {
      return res
        .status(400)
        .json({ ok: false, error: 'Provide password or passwordHash' });
    }

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstNameTh: firstNameTh || '',
        lastNameTh: lastNameTh || '',
        firstNameEn: firstNameEn || '',
        lastNameEn: lastNameEn || '',
        roleId: Number(roleId),
        departmentId: Number(departmentId),
      },
      select: baseSelect,
    });

    res.status(201).json({ ok: true, data: created });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- UPDATE (admin or self-limited): PATCH /api/users/:id ----------
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.session.user;

    const target = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!target) return res.status(404).json({ ok: false, error: 'Not found' });

    // สิทธิ์:
    // - admin: อัปเดตได้ทุกฟิลด์ (ยกเว้นรหัสผ่าน ใช้ endpoint เฉพาะ)
    // - non-admin: อัปเดตได้เฉพาะของตัวเอง และเฉพาะชื่อ (th/en) เท่านั้น
    const isAdmin = me.roleName === 'admin';
    const isSelf = me.id === id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const {
      email,
      firstNameTh,
      lastNameTh,
      firstNameEn,
      lastNameEn,
      roleId,
      departmentId,
    } = req.body || {};

    const data = {};

    if (isAdmin) {
      if (email) data.email = email;
      if (roleId !== undefined) data.roleId = Number(roleId);
      if (departmentId !== undefined) data.departmentId = Number(departmentId);
    }
    // ส่วนที่ทุกคน (รวมถึง non-admin) อัปเดตได้
    if (firstNameTh !== undefined) data.firstNameTh = firstNameTh;
    if (lastNameTh !== undefined) data.lastNameTh = lastNameTh;
    if (firstNameEn !== undefined) data.firstNameEn = firstNameEn;
    if (lastNameEn !== undefined) data.lastNameEn = lastNameEn;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: 'No updatable fields' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: baseSelect,
    });

    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- RESET PASSWORD (admin-only): POST /api/users/:id/reset-password ----------
router.post('/:id/reset-password', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: 'newPassword must be at least 8 characters' });
    }

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- DELETE: soft (self or admin) / hard (admin only): DELETE /api/users/:id ----------
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.session.user;
    const hard = parseBool(req.query.hard);

    const target = await prisma.user.findFirst({
      where: { id },
      select: { id: true, deletedAt: true, roleId: true },
    });
    if (!target) return res.status(404).json({ ok: false, error: 'Not found' });

    // HARD DELETE → ต้อง admin เท่านั้น และไม่ให้ลบตัวเองกันล็อกเอาท์ระบบโดยไม่ตั้งใจ
    if (hard) {
      if (me.roleName !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin only (hard delete)' });
      }
      if (me.id === id) {
        return res
          .status(400)
          .json({ ok: false, error: 'Cannot hard delete yourself' });
      }
      await prisma.user.delete({ where: { id } });
      return res.json({ ok: true, hardDeleted: true });
    }

    // SOFT DELETE → อนุญาตถ้าเป็น admin หรือเป็นเจ้าของเอง
    const isSelf = me.id === id;
    if (me.roleName !== 'admin' && !isSelf) {
      return res.status(403).json({ ok: false, error: 'Forbidden (soft delete only self)' });
    }
    if (target.deletedAt) {
      return res.json({ ok: true, softDeleted: true }); // ถูกลบอยู่แล้ว
    }
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return res.json({ ok: true, softDeleted: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- RESTORE (admin-only): POST /api/users/:id/restore ----------
router.post('/:id/restore', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findFirst({ where: { id }, select: { id: true } });
    if (!user) return res.status(404).json({ ok: false, error: 'Not found' });

    const restored = await prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      select: baseSelect,
    });

    res.json({ ok: true, data: restored });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});
