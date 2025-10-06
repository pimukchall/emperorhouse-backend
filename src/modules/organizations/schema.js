import { z } from "zod";

// แปลงค่าจาก "1"/"true"/true เป็น boolean
const Boolish = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    if (s === "1" || s === "true") return true;
    if (s === "0" || s === "false") return false;
  }
  return undefined;
}, z.boolean().optional());

export const OrgParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const OrgListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().optional(),
  includeDeleted: Boolish.default(false),
  sortBy: z.enum(["createdAt", "code", "nameTh", "nameEn"]).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
});

export const OrgCreate = z.object({
  code: z.string().trim().min(1, "ต้องระบุรหัสองค์กร"),
  nameTh: z.string().trim().nullish().transform(v => v ?? null),
  nameEn: z.string().trim().nullish().transform(v => v ?? null),
});

 export const OrgUpdate = z.object({
  code: z.string().trim().min(1).optional(),
  nameTh: z.string().trim().nullish().transform(v => v ?? null).optional(),
  nameEn: z.string().trim().nullish().transform(v => v ?? null).optional(),
});

export const OrgDeleteQuery = z.object({
  hard: Boolish.default(false),
});
