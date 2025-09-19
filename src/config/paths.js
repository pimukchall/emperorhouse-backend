import path from "path";
import fs from "fs";

const PROJECT_ROOT = process.cwd();

/**
 * โฟลเดอร์อัปโหลดหลัก (อยู่นอกโปรเจกต์)
 * - ดีฟอลต์: ขึ้นไป 1 ชั้นจากโปรเจกต์ → ../upload
 * - สามารถ override ด้วย .env: UPLOADS_DIR
 */
const ENV_UPLOADS = process.env.UPLOADS_DIR;

export const UPLOADS_BASE = ENV_UPLOADS
  ? (path.isAbsolute(ENV_UPLOADS) ? ENV_UPLOADS : path.resolve(PROJECT_ROOT, ENV_UPLOADS))
  : path.resolve(PROJECT_ROOT, "..", "upload");

// โฟลเดอร์ย่อย (พหูพจน์ให้ตรงกับ URL convention)
export const AVATAR_BASE = path.join(UPLOADS_BASE, "avatars");
export const SIGNATURE_BASE = path.join(UPLOADS_BASE, "signatures");

// ensure directories
for (const p of [UPLOADS_BASE, AVATAR_BASE, SIGNATURE_BASE]) {
  fs.mkdirSync(p, { recursive: true });
}