import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = process.cwd();

// เก็บไว้ที่ .../upload (ขึ้นไป 1 ชั้นจากโปรเจ็กต์)
export const UPLOAD_ROOT = path.resolve(PROJECT_ROOT, '..', 'upload');

// โฟลเดอร์ย่อยสำหรับ avatar
export const AVATAR_BASE = path.join(UPLOAD_ROOT, 'user', 'avatar');

// ensure directories
for (const p of [UPLOAD_ROOT, AVATAR_BASE]) {
  fs.mkdirSync(p, { recursive: true });
}
