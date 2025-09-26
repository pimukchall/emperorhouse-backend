import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { submitContactService } from "../services/contacts.service.js";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(3).max(32).optional(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

export const createContactController = [
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body ?? {});
    const result = await submitContactService({ body });
    res.status(201).json({ ok: true, ...result });
  }),
];

export const listContactsController = [
  asyncHandler(async (req, res) => {
    // ให้ service ทำงาน list (ถ้าคุณมี service list แล้ว)
    // ที่เดิม controller ทำเอง เราแนะนำย้ายเข้า service เพื่อความสม่ำเสมอ
    res
      .status(501)
      .json({ ok: false, error: "LIST_NOT_IMPLEMENTED_IN_SERVICE" });
  }),
];

export const getContactController = [
  asyncHandler(async (req, res) => {
    res
      .status(501)
      .json({ ok: false, error: "GET_NOT_IMPLEMENTED_IN_SERVICE" });
  }),
];

export const deleteContactController = [
  asyncHandler(async (req, res) => {
    res
      .status(501)
      .json({ ok: false, error: "DELETE_NOT_IMPLEMENTED_IN_SERVICE" });
  }),
];
