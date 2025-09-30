import { z } from "zod";

const Boolish = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    if (s === "1" || s === "true") return true;
    if (s === "0" || s === "false") return false;
  }
  return undefined;
}, z.boolean().optional());

export const UdParam = z.object({
  udId: z.coerce.number().int().positive(),
});

export const UserParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const UserParam2 = z.object({
  userId: z.coerce.number().int().positive(),
});

export const ListQuery = z.object({
  activeOnly: Boolish.default(false),
});

export const AssignBody = z.object({
  userId: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive(),
  positionLevel: z.enum(["STAF", "SVR", "ASST", "MANAGER", "MD"]),
  positionName: z.string().trim().nullable().optional(),
  startedAt: z.string().datetime().optional(),
});

export const EndOrRenameBody = z.object({
  positionName: z.string().trim().nullable().optional(),
  endedAt: z.string().datetime().optional(),
});

export const ChangeLevelBody = z.object({
  udId: z.coerce.number().int().positive(),
  newLevel: z.enum(["STAF", "SVR", "ASST", "MANAGER", "MD"]),
  actorId: z.coerce.number().int().positive().nullable().optional(),
  effectiveDate: z.string().datetime().optional(),
  reason: z.string().trim().nullable().optional(),
  newPositionName: z.string().trim().nullable().optional(),
});

export const SetPrimaryParams = z.object({
  userId: z.coerce.number().int().positive(),
  udId: z.coerce.number().int().positive(),
});
