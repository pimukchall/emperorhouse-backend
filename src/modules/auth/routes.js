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
} from "./controller.js";
import { requireAuth, requireMe } from "#mw/auth.js";
import { validate } from "#mw/validate.js";
import * as S from "./schema.js";

const r = Router();

// public
r.post("/register", validate(S.Register), ...registerController);
r.post("/login", validate(S.Login), ...loginController);
r.post("/forgot", validate(S.Forgot), ...forgotPasswordController);
r.post("/reset", validate(S.Reset), ...resetPasswordController);
r.post("/refresh", ...refreshController);

// protected
r.post("/logout", requireAuth, ...logoutController);
r.get("/me", requireAuth, requireMe, ...meController);
r.post("/change-password", requireAuth, validate(S.ChangePassword), ...changePasswordController);

export default r;
