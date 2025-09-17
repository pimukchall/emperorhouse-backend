import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AVATAR_BASE } from '../config/paths.js';

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ยังไม่รู้ userId จนกว่าจะถึง handler ⇒ เก็บไฟล์ชั่วคราวที่โฟลเดอร์ avatar root
    cb(null, AVATAR_BASE);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, `temp-${Date.now()}${ext}`);
  }
});

export const uploadAvatarSingle = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED.has(file.mimetype)) {
      return cb(new Error('Only jpeg/png/webp allowed'));
    }
    cb(null, true);
  }
}).single('avatar'); // ฟิลด์ชื่อ 'avatar'
