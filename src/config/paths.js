import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = process.cwd();

/**
 * โฟลเดอร์อัปโหลดหลัก (นอกโปรเจกต์)
 * - ดีฟอลต์: ขึ้นไป 1 ชั้นจากโปรเจกต์ → ../upload
 * - สามารถ override ด้วย .env: UPLOADS_DIR
 */
const ENV_UPLOADS = process.env.UPLOADS_DIR;

export const UPLOADS_BASE = ENV_UPLOADS
  ? (path.isAbsolute(ENV_UPLOADS) ? ENV_UPLOADS : path.resolve(PROJECT_ROOT, ENV_UPLOADS))
  : path.resolve(PROJECT_ROOT, '..', 'upload');

// โฟลเดอร์ย่อยสำหรับ avatar (ใช้พหูพจน์ 'avatars' ให้ตรงกับ URL /files/avatars/**)
export const AVATAR_BASE = path.join(UPLOADS_BASE, 'avatars');

// ensure directories
for (const p of [UPLOADS_BASE, AVATAR_BASE]) {
  fs.mkdirSync(p, { recursive: true });
}
