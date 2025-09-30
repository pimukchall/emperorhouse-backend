import { z } from "zod";

// ใช้กับ GET /roles/:id  (รองรับทั้ง id ตัวเลขหรือ name ตัวอักษร)
export const RoleParams = z.object({
  id: z.string().trim().min(1),
});

// ใช้กับ POST/PATCH /roles
export const RoleUpsert = z.object({
  name: z.string().trim().min(1),
  labelTh: z.string().trim().nullish().transform(v => v ?? null),
  labelEn: z.string().trim().nullish().transform(v => v ?? null),
});
