import { toInt, normalizeSort } from "./query.util.js";

/**
 * applyPrismaPagingSort(
 *   baseArgs,
 *   { page=1, limit=20, skip=0, sortBy="createdAt", sort="asc" },
 *   { sortMap } // e.g. { id:"id", code:"code", createdAt:"createdAt" }
 * )
 */
export function applyPrismaPagingSort(
  baseArgs = {},
  { page = 1, limit = 20, skip = 0, sortBy = "createdAt", sort = "asc" } = {},
  { sortMap = {} } = {}
) {
  const take = Math.max(1, toInt(limit, 20));         // อย่างน้อย 1
  const p = Math.max(1, toInt(page, 1));
  const sk = toInt(skip, 0) ?? 0;
  const computedSkip = sk || (p - 1) * take;

  // map ชื่อ sortBy (จาก query) -> ฟิลด์จริงใน prisma (whitelist)
  const field = sortMap[sortBy] || sortMap.default || "createdAt";
  const ord = normalizeSort(sort, "asc");             // ปริยาย asc ตามสเป็ก

  const out = {
    ...baseArgs,
    skip: computedSkip,
    take,
  };

  if (field) {
    // ✅ รูปแบบที่ตกลงกัน: { [field]: "asc" | "desc" }
    out.orderBy = { [field]: ord };
  }

  return out;
}

export function buildListResponse({ rows, total, page = 1, limit = 20, sortBy, sort }) {
  const p = Math.max(1, toInt(page, 1));
  const l = Math.max(1, toInt(limit, 20));
  const pages = Math.max(1, Math.ceil(Number(total || 0) / l));
  return {
    data: rows,
    meta: {
      total: Number(total || 0),
      page: p,
      limit: l,
      pages,
      ...(sortBy ? { sortBy } : {}),
      ...(sort ? { sort } : {}),
    },
  };
}