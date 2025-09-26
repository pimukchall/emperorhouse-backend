const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * parsePaging(query, options?)
 * options.allowedSort: รายชื่อคอลัมน์ที่อนุญาตให้ sort (เช่น ["createdAt","updatedAt","name"])
 * options.defaultSort: คีย์เริ่มต้นเมื่อไม่ได้ส่งมา (เช่น "createdAt")
 * options.defaultOrder: "asc" | "desc"
 */
export function parsePaging(query = {}, options = {}) {
  const { allowedSort = [], defaultSort = allowedSort[0] || "createdAt", defaultOrder = "desc" } = options;

  const page  = clamp(parseInt(query.page ?? "1", 10) || 1, 1, 1_000_000);
  const limit = clamp(parseInt(query.limit ?? "20", 10) || 20, 1, 100);
  const skip  = (page - 1) * limit;

  // sort & order (ปลอดภัยด้วย allowlist)
  let sort = String(query.sort ?? defaultSort);
  if (!allowedSort.includes(sort)) sort = defaultSort;

  let order = String(query.order ?? defaultOrder).toLowerCase();
  if (!["asc", "desc"].includes(order)) order = defaultOrder;

  return { page, limit, skip, sort, order };
}

export function buildListResponse({ rows, total, page, limit }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 1)));
  return { ok: true, data: rows, meta: { page, limit, pages, total } };
}

/**
 * ช่วยเตรียมออปชันสำหรับ Prisma (เลือกใช้ได้)
 * prismaArgs = applyPrismaPagingSort({}, paging, { sortMap: { createdAt: "createdAt", name: "name" } })
 */
export function applyPrismaPagingSort(prismaArgs = {}, paging, { sortMap = {} } = {}) {
  const orderByKey = sortMap[paging.sort] || paging.sort;
  return {
    ...prismaArgs,
    skip: paging.skip,
    take: paging.limit,
    orderBy: { [orderByKey]: paging.order },
  };
}
