// src/routes/auth.routes.js
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
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/register", registerController);
router.post("/login",    loginController);
router.post("/refresh",  refreshController);
router.post("/logout",   logoutController);
router.get("/me",        meController);

router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password",  resetPasswordController);
router.post("/change-password", requireAuth, changePasswordController);

export default router;
export { router };
