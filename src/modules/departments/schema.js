import { z } from "zod";

export const DeptParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const DeptListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(["id", "code", "nameTh", "nameEn", "createdAt", "updatedAt"]).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
  q: z.string().optional(),
});

export const DeptUpsert = z.object({
  code: z.string().trim().min(1),
  nameTh: z.string().trim().min(1),
  // อนุญาตเว้นได้ -> เก็บเป็น null
  nameEn: z.string().trim().nullish().transform(v => v ?? null),
});
