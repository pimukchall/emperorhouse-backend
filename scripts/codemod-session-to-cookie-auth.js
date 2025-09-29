import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const includeExt = new Set([".js", ".cjs", ".mjs", ".ts"]);
const skipDirs = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

const replacements = [
  // -------- user id extraction: session → cookie-JWT --------
  // common 1-liner usages
  {
    name: "read-session-user-id-ternary",
    search: /req\.session\?.user\?.id/g,
    replace: "req.user?.id || req.userId || req.auth?.sub",
  },
  {
    name: "read-session-user-id-direct",
    search: /req\.session\.user\.id/g,
    replace: "req.user?.id || req.userId || req.auth?.sub",
  },

  // -------- snapshot write: ป้องกัน req.session ไม่ถูก define --------
  // NOTE: ใส่เป็นรูปแบบที่สคริปต์ add guard ภายหลัง (ดูฟังก์ชัน ensureSessionGuard)
  // ไม่ replace ตรง ๆ ที่นี่

  // -------- active assignments: endedAt:null → + isActive:true --------
  {
    name: "where-active-endedAt-only-1",
    search: /endedAt\s*:\s*null\s*\}/g, // } ปิด object
    replace: "endedAt: null, isActive: true }",
  },
  {
    name: "where-active-endedAt-only-2",
    search: /endedAt\s*:\s*null\s*,/g, // , มีต่อท้าย
    replace: "endedAt: null, isActive: true,",
  },

  // -------- clearCookie: ใช้ sameSite:none --------
  {
    name: "clear-cookie-samesite-lax-access",
    search: /clearCookie\(\s*["']access_token["']\s*,\s*\{[^}]*sameSite:\s*["']lax["'][^}]*\}\s*\)/g,
    replace: 'clearCookie("access_token", { httpOnly:true, path:"/", sameSite:"none", secure: process.env.NODE_ENV==="production" })',
  },
  {
    name: "clear-cookie-samesite-lax-refresh",
    search: /clearCookie\(\s*["']refresh_token["']\s*,\s*\{[^}]*sameSite:\s*["']lax["'][^}]*\}\s*\)/g,
    replace: 'clearCookie("refresh_token", { httpOnly:true, path:"/", sameSite:"none", secure: process.env.NODE_ENV==="production" })',
  },
];

function ensureSessionGuard(code) {
  // ถ้ามีการเขียน req.session.user = ... แต่ไม่มี guard ให้เติม `req.session = req.session || {};` ก่อนหน้า 1 บรรทัด
  // ใช้ heuristic: มองย้อนกลับไป 5 บรรทัด ถ้าไม่พบ "req.session =" ให้แทรก
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/req\.session\.user\s*=/.test(lines[i])) {
      let hasGuard = false;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (/req\.session\s*=\s*req\.session\s*\|\|\s*\{\s*\}\s*;?/.test(lines[j])) {
          hasGuard = true;
          break;
        }
      }
      if (!hasGuard) {
        lines.splice(i, 0, "req.session = req.session || {};");
        i++; // shift
      }
    }
  }
  return lines.join("\n");
}

function shouldSkip(p) {
  const parts = p.split(path.sep);
  return parts.some((seg) => skipDirs.has(seg));
}

function walk(dir, files = []) {
  if (shouldSkip(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (shouldSkip(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

function processFile(file) {
  const ext = path.extname(file);
  if (!includeExt.has(ext)) return false;

  let src = fs.readFileSync(file, "utf8");
  let orig = src;

  // skip minified/binary-ish
  if (src.length > 2_000_000) return false;

  // do replacements
  for (const r of replacements) {
    src = src.replace(r.search, r.replace);
  }

  // add guard for session write
  if (/req\.session\.user\s*=/.test(src)) {
    src = ensureSessionGuard(src);
  }

  if (src !== orig) {
    fs.writeFileSync(file, src, "utf8");
    console.log("patched:", path.relative(ROOT, file));
    return true;
  }
  return false;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Cannot find src/ at:", SRC);
    process.exit(1);
  }
  const files = walk(SRC);
  let count = 0;
  for (const f of files) {
    try {
      if (processFile(f)) count++;
    } catch (e) {
      console.error("error:", f, e.message);
    }
  }
  console.log(`\nDone. Patched files: ${count}`);
}

main();
