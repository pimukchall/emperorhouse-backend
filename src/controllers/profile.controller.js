import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { selfUpdateProfileService } from "../services/users.service.js";

const selfUpdateSchema = z.object({
  name: z.string().trim().optional(),
  firstNameTh: z.string().trim().optional(),
  lastNameTh: z.string().trim().optional(),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  gender: z
    .enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"])
    .nullable()
    .optional(),
  avatarPath: z.string().trim().nullable().optional(),
  signature: z.any().optional(),
});

export const selfUpdateProfileController = [
  asyncHandler(async (req, res) => {
    const uid =
      req.user?.id ??
      req.auth?.user?.id ??
      req.userId ??
      req.auth?.sub ??
      res.locals?.user?.id;
    if (!uid) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const data = selfUpdateSchema.parse(req.body ?? {});
    const updated = await selfUpdateProfileService({
      userId: Number(uid),
      data,
    });
    res.json({ ok: true, data: updated });
  }),
];
