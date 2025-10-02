import { z } from "zod";

// แปลง "1"/"true" → true
const Boolish = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    if (s === "1" || s === "true") return true;
    if (s === "0" || s === "false") return false;
  }
  return undefined;
}, z.boolean().optional());

export const UserParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const UserListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().optional(),
  includeDeleted: Boolish.default(false),
  roleId: z.coerce.number().int().positive().optional(),
  orgId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(["createdAt", "email", "name"]).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
});

export const UserCreate = z.object({
  email: z.string().email(),
  password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"),
  name: z.string().trim().optional(),
  roleId: z.coerce.number().int().positive().optional(),
  orgId: z.coerce.number().int().positive().nullable().optional(),
  firstNameTh: z.string().trim().optional(),
  lastNameTh: z.string().trim().optional(),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]).nullable().optional(),
});

export const UserUpdate = UserCreate.partial();

export const SetPrimaryDept = z.object({
  departmentId: z.coerce.number().int().positive(),
});

export const SelfUpdate = z.object({
  name: z.string().trim().optional(),
  firstNameTh: z.string().trim().optional(),
  lastNameTh: z.string().trim().optional(),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]).nullable().optional(),
  avatarPath: z.string().trim().nullable().optional(),
  signature: z.any().optional(),
});

export const DeleteQuery = z.object({
  hard: Boolish.default(false),
});
