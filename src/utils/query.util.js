export function toInt(v, fallback = undefined) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeSort(v, fallback = "asc") {
  const got = String(v || "").toLowerCase();
  return got === "desc" ? "desc" : got === "asc" ? "asc" : fallback;
}

/** เลือกฟิลด์จาก whitelist เท่านั้น */
export function pickSort(sortBy, allowed = ["id"]) {
  return allowed.includes(sortBy) ? sortBy : allowed[0];
}

/** case-insensitive contains สำหรับ Prisma (MySQL 8+) */
export function ilikeContains(q) {
  return { contains: String(q), mode: "insensitive" };
}

export function isNonEmpty(v) {
  return !(v === undefined || v === null || v === "");
}