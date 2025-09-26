import path from "node:path";
import fs from "node:fs";
import { env } from "../config/env.js";

const PROJECT_ROOT = process.cwd();
const ENV_UPLOADS = env.UPLOAD_BASE_DIR;

export const UPLOADS_BASE = ENV_UPLOADS
  ? path.isAbsolute(ENV_UPLOADS)
    ? ENV_UPLOADS
    : path.resolve(PROJECT_ROOT, "..", ENV_UPLOADS)
  : path.resolve(PROJECT_ROOT, "..", "upload");

export const AVATAR_BASE = path.join(UPLOADS_BASE, "avatars");
export const SIGNATURE_BASE = path.join(UPLOADS_BASE, "signatures");

export function ensureUploadDirs() {
  for (const p of [UPLOADS_BASE, AVATAR_BASE, SIGNATURE_BASE]) {
    fs.mkdirSync(p, { recursive: true });
  }
}
