import { Router } from "express";
import { getTransporter } from "../lib/mailer.js";

const router = Router();

router.get("/", (_req, res) => res.json({ ok: true }));

router.get("/smtp", async (_req, res) => {
  try {
    const tx = await getTransporter();
    await tx.verify();
    res.json({
      ok: true,
      transporter: tx.options && { host: tx.options.host, port: tx.options.port },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export { router };
export default router;
