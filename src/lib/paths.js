// src/paths.js
import path from "node:path";
import fs from "node:fs";

/**
 * โฟลเดอร์อัปโหลดหลัก (อยู่นอกโปรเจกต์ emp-api)
 * - default: ../upload (ขึ้นไป 1 ชั้นจากรากโปรเจกต์)
 * - override ด้วย .env: UPLOAD_BASE_DIR
 *   - ถ้าเป็น absolute → ใช้ตามนั้น
 *   - ถ้าเป็น relative → อ้างอิงจาก <project-root>/.. (นอกโปรเจกต์)
 */
const PROJECT_ROOT = process.cwd();
const ENV_UPLOADS = process.env.UPLOAD_BASE_DIR;

export const UPLOADS_BASE = ENV_UPLOADS
  ? (path.isAbsolute(ENV_UPLOADS)
      ? ENV_UPLOADS
      : path.resolve(PROJECT_ROOT, "..", ENV_UPLOADS))
  : path.resolve(PROJECT_ROOT, "..", "upload");

// โฟลเดอร์ย่อย
export const AVATAR_BASE = path.join(UPLOADS_BASE, "avatars");
export const SIGNATURE_BASE = path.join(UPLOADS_BASE, "signatures");

// ensure directories (เรียกจาก index.js ตอนบูตแอป)
export function ensureUploadDirs() {
  for (const p of [UPLOADS_BASE, AVATAR_BASE, SIGNATURE_BASE]) {
    fs.mkdirSync(p, { recursive: true });
  }
}
