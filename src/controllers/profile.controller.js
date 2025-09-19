import { prisma } from "../prisma.js";
import { selfUpdateProfileService } from "../services/users.service.js";

export async function selfUpdateProfileController(req, res) {
  try {
    // ดึง user id จากหลายแหล่งที่ middleware อาจจะใส่ไว้แตกต่างกัน
    const uid =
      req.user?.id ??
      req.auth?.user?.id ??
      req.session?.user?.id ??
      res.locals?.user?.id;

    if (!uid) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const updated = await selfUpdateProfileService({
      prisma,
      userId: Number(uid),
      data: req.body ?? {},
    });

    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ error: e?.message || "UPDATE_FAILED" });
  }
}
