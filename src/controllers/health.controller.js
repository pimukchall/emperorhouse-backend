import { healthService } from "../services/health.service.js";

export async function healthController(_req, res) {
  const data = await healthService();
  res.json({ ok: true, ...data });
}
