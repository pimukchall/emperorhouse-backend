import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middlewares/auth.js';

export const router = Router();

/**
 * POST /auth/login
 * body: { email, password, remember? }
 * - remember: true => เซสชัน 7 วัน, false/ไม่ส่ง => 1 วัน
 */
router.post('/login', async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'email & password required' });
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: { role: true, department: true }
  });

  if (!user) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  // ตั้ง maxAge ตาม remember
  // 1 วัน = 24 * 60 * 60 * 1000, 7 วัน = ... * 7
  req.sessionOptions.maxAge = (remember ? 7 : 1) * 24 * 60 * 60 * 1000;

  // เก็บเฉพาะข้อมูลจำเป็นลง session (เล็ก ปลอดภัยกว่า)
  req.session.user = {
    id: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role?.name,
    departmentId: user.departmentId,
    deptCode: user.department?.code,
  };

  // อัปเดตเวลาล็อกอินล่าสุด (ถ้าต้องการ track)
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() }
  });

  return res.json({
    ok: true,
    data: {
      id: user.id,
      email: user.email,
      role: { id: user.roleId, name: user.role?.name },
      department: { id: user.departmentId, code: user.department?.code },
    }
  });
});

/** POST /auth/logout */
router.post('/logout', (req, res) => {
  req.session = null; // ลบคุกกี้
  res.json({ ok: true });
});

/** GET /auth/me - ดูสถานะล็อกอินปัจจุบัน */
router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(200).json({ ok: true, isAuthenticated: false });
  }
  return res.json({ ok: true, isAuthenticated: true, user: req.session.user });
});

/**
 * POST /auth/change-password
 * body: { currentPassword, newPassword }
 * ต้องล็อกอิน และตรวจรหัสผ่านเดิมให้ถูกก่อน
 */
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'currentPassword & newPassword required' });
  }

  const me = await prisma.user.findFirst({
    where: { id: req.session.user.id, deletedAt: null }
  });
  if (!me) return res.status(404).json({ ok: false, error: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, me.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid current password' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash } });

  res.json({ ok: true });
});

/**
 * POST /auth/register
 * body: {
 *   email, password,
 *   firstNameTh, lastNameTh, firstNameEn, lastNameEn,
 *   departmentId   // ต้องระบุ เพราะ schema บังคับ not null
 * }
 * - จะ set role เป็น "staff" อัตโนมัติ (หาโดย name = 'staff')
 */
router.post('/register', async (req, res) => {
  try {
    const {
      email, password,
      firstNameTh, lastNameTh, firstNameEn, lastNameEn,
      departmentId
    } = req.body || {};

    if (!email || !password || !departmentId) {
      return res.status(400).json({ ok: false, error: 'email, password, departmentId required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: 'password must be at least 8 characters' });
    }

    // email ต้องไม่ซ้ำ
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists && !exists.deletedAt) {
      return res.status(409).json({ ok: false, error: 'Email already in use' });
    }

    // หา role staff
    const staffRole = await prisma.role.findUnique({ where: { name: 'staff' } });
    if (!staffRole) {
      return res.status(500).json({ ok: false, error: 'Default role "staff" not found. Please seed roles.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstNameTh: firstNameTh || '',
        lastNameTh:  lastNameTh  || '',
        firstNameEn: firstNameEn || '',
        lastNameEn:  lastNameEn  || '',
        roleId: staffRole.id,
        departmentId: Number(departmentId),
      },
      select: {
        id: true, email: true,
        firstNameTh: true, lastNameTh: true,
        firstNameEn: true, lastNameEn: true,
        role: { select: { id: true, name: true } },
        department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        createdAt: true, updatedAt: true
      }
    });

    return res.status(201).json({ ok: true, data: created });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});