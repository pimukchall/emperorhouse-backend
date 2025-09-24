import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { selfUpdateProfileController } from "../controllers/profile.controller.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const me =
    req.me || req.user || req.auth?.user || req.session?.user || null;

  if (!me) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  res.json({ ok: true, data: me });
});

router.patch("/", requireAuth, selfUpdateProfileController);

export default router;
export { router };
