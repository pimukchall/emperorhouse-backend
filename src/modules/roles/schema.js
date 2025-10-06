import { z } from "zod";

// ใช้กับ GET /roles/:id  (รองรับทั้ง id ตัวเลขหรือ name ตัวอักษร)
export const RoleParams = z.object({
  id: z.string().trim().min(1),
});

// ใช้กับ POST/PATCH /roles
export const RoleUpsert = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(50)
    // ทางเลือก: จำกัดรูปแบบให้เป็น slug พิมพ์เล็ก
    .regex(/^[a-z0-9._-]+$/, "ใช้ตัวพิมพ์เล็ก ตัวเลข และ . _ - เท่านั้น"),
  labelTh: z.string().trim().max(120).nullish().transform(v => v ?? null),
  labelEn: z.string().trim().max(120).nullish().transform(v => v ?? null),
});
