import { Router } from "express";
import { healthController } from "../controllers/health.controller.js";

const r = Router();
r.get("/", ...healthController); // public
export default r;
