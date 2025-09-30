import { z } from "zod";

export const ContactCreate = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  phone: z.string().trim().max(32).optional(),
  subject: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export const ContactListQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().optional(),
  email: z.string().email().optional(),
  sortBy: z.enum(["createdAt", "subject", "email"]).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
});

export const ContactParams = z.object({
  id: z.coerce.number().int().positive(),
});
