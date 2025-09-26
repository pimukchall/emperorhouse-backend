import { Router } from "express";
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  meController,
  forgotPasswordController,
  resetPasswordController,
  changePasswordController,
} from "../controllers/auth.controller.js";
import { requireAuth, requireMe } from "../middlewares/auth.js";

const r = Router();

// public
r.post("/register", ...registerController);
r.post("/login", ...loginController);
r.post("/refresh", ...refreshController);
r.post("/forgot", ...forgotPasswordController);
r.post("/reset", ...resetPasswordController);

// need auth
r.post("/logout", requireAuth, ...logoutController);
r.get("/me", requireAuth, requireMe, ...meController);
r.post("/change-password", requireAuth, ...changePasswordController);

export default r;
