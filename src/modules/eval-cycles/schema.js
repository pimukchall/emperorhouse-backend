import { z } from "zod";

export const StageEnum = z.enum(["MID_YEAR", "YEAR_END"]);

export const CycleParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const CycleListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sortBy: z.enum(["id", "code", "year", "stage", "openAt", "closeAt", "isActive", "createdAt"]).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
});

export const CycleCreate = z.object({
  code: z.string().trim().min(1),
  year: z.coerce.number().int().min(2000),
  stage: StageEnum,
  openAt: z.coerce.date(),
  closeAt: z.coerce.date(),
  isActive: z.coerce.boolean().optional().default(true),
  isMandatory: z.coerce.boolean().optional().default(true),
});

export const CycleUpdate = CycleCreate.partial();