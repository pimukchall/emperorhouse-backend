import { z } from "zod";

export const IdParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const CycleParam = z.object({
  cycleId: z.coerce.number().int().positive(),
});

export const ListQuery = z.object({
  cycleId: z.coerce.number().int().positive().optional(),
  owner: z.enum(["me"]).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  status: z.enum(["DRAFT","SUBMITTED","APPROVER_APPROVED","COMPLETED","REJECTED"]).optional(),
});

export const Create = z.object({
  cycleId: z.coerce.number().int().positive(),
  ownerId: z.coerce.number().int().positive().optional(),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  mdId: z.coerce.number().int().positive().nullable().optional(),
  type: z.enum(["OPERATIONAL","SUPERVISOR"]).optional(),
});

export const Update = z.record(z.any());

export const SignBody = z.object({
  signature: z.string().min(16),
  comment: z.string().trim().nullable().optional(),
});
