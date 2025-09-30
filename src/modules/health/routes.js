import { Router } from "express";
import { healthController } from "./controller.js";

const r = Router();
r.get("/", ...healthController);
export default r;
