import { prisma } from "../prisma.js";
import { selfUpdateProfileService } from "../services/users.service.js";

export async function selfUpdateProfileController(req, res) {
  try {
    const uid =
      req.user?.id ??
      req.auth?.user?.id ??
      ((req.user?.id || req.userId || req.auth?.sub) ??
      res.locals?.user?.id);

    if (!uid) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const updated = await selfUpdateProfileService({
      prisma,
      userId: Number(uid),
      data: req.body ?? {},
    });

    return res.json({ ok: true, data: updated });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e?.message || "UPDATE_FAILED" });
  }
}
