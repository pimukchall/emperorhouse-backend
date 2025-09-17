import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { uploadAvatarSingle } from '../middlewares/upload.js';
import { AVATAR_BASE, UPLOAD_ROOT } from '../config/paths.js';

export const router = Router();

/**
 * PUT /profile/avatar
 * form-data: avatar (file)
 * - บีบเป็น webp ขนาด max 512x512, quality ~80
 * - เก็บที่ ../upload/user/avatar/{userId}/avatar.webp
 */
router.put('/avatar', requireAuth, (req, res) => {
  uploadAvatarSingle(req, res, async (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });

    const userId = req.session.user.id;
    const userDir = path.join(AVATAR_BASE, String(userId));
    const outPath = path.join(userDir, 'avatar.webp');

    try {
      fs.mkdirSync(userDir, { recursive: true });

      // แปลงและบีบอัด
      await sharp(req.file.path)
        .rotate()                  // auto-rotate ตาม EXIF
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outPath);

      // ลบไฟล์ temp
      fs.unlink(req.file.path, () => {});

      // เก็บ path แบบ relative จาก UPLOAD_ROOT
      const rel = path.relative(UPLOAD_ROOT, outPath).replaceAll('\\', '/'); // "user/avatar/12/avatar.webp"
      await prisma.user.update({
        where: { id: userId },
        data: { avatarPath: rel }
      });

      // รีเฟรชข้อมูลใน session ด้วย (ถ้าต้องการ client อ่าน /auth/me จะเห็นค่าเดียวกัน)
      req.session.user.avatarPath = rel;

      res.json({ ok: true, path: `/files/${rel}` });
    } catch (e) {
      // ลบไฟล์ temp เสมอ
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ ok: false, error: e.message });
    }
  });
});

/**
 * GET /files/user/avatar/:userId  → ดึงไฟล์ avatar (ถ้ามี)
 * - เสิร์ฟจากนอกโปรเจ็กต์อย่างปลอดภัย
 */
router.get('/files/user/avatar/:userId', async (req, res) => {
  const id = Number(req.params.userId);
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { avatarPath: true } });
  if (!user?.avatarPath) {
    return res.status(404).end();
  }
  const abs = path.join(UPLOAD_ROOT, user.avatarPath);
  if (!fs.existsSync(abs)) return res.status(404).end();
  res.sendFile(abs);
});
