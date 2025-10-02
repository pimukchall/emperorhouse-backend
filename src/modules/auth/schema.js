import { z } from "zod";

export const Register = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().optional(),
  // ช่องทางรองรับในอนาคต (ถ้าอยากส่งชื่อจริง)
  firstNameTh: z.string().trim().optional(),
  lastNameTh: z.string().trim().optional(),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
});

export const Login = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const ChangePassword = z.object({
  // เดิม min(6) -> เพิ่มเป็น 8 เพื่อให้ policy ตรงกัน
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

export const Forgot = z.object({
  email: z.string().email(),
});

export const Reset = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});
