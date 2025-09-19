// util ช่วยอ่าน query params + ทำ where/orderBy ให้ปลอดภัย

export function parsePaging(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit || defaultLimit)));
  const sort = (req.query.sort || "desc").toString().toLowerCase() === "asc" ? "asc" : "desc";
  const sortBy = (req.query.sortBy || req.query.orderBy || "id").toString();
  const skip = (page - 1) * limit;
  return { page, limit, skip, sort, sortBy };
}

/**
 * คืน object สำหรับ Prisma string filter แบบ "contains"
 * **ไม่** ใส่ { mode: "insensitive" } เพื่อให้ทำงานได้ทุกฐาน
 */
export function ilikeContains(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return { contains: s }; // <-- ตัด mode ออก
}

export function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function pickSort(field, allowed = []) {
  const f = (field || "").toString();
  return allowed.includes(f) ? f : allowed[0];
}
