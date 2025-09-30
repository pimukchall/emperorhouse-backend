import { asyncHandler } from "#utils/asyncHandler.js";
import { healthService } from "./service.js";

export const healthController = [
  asyncHandler(async (_req, res) => {
    const data = await healthService();
    res.json({ ok: true, data });
  }),
];
