import { asyncHandler } from "#utils/asyncHandler.js";
import {
  registerService,
  loginService,
  refreshService,
  logoutService,
  meService,
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
} from "./service.js";
import { setRefreshCookie, clearRefreshCookie } from "#lib/tokens.js";

// POST /api/auth/register
export const registerController = [
  asyncHandler(async (req, res) => {
    const result = await registerService({ payload: req.body });
    if (result.tokens?.refreshToken)
      setRefreshCookie(res, result.tokens.refreshToken);
    res.json({
      ok: true,
      user: result.sessionUser,
      accessToken: result.tokens?.accessToken,
    });
  }),
];

// POST /api/auth/login
export const loginController = [
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await loginService({ email, password });
    if (result.tokens?.refreshToken)
      setRefreshCookie(res, result.tokens.refreshToken);
    res.json({
      ok: true,
      user: result.sessionUser,
      accessToken: result.tokens?.accessToken,
    });
  }),
];

// POST /api/auth/refresh
export const refreshController = [
  asyncHandler(async (req, res) => {
    const token =
      req.cookies?.refresh_token ||
      req.cookies?.refreshToken ||
      req.cookies?.REFRESH_TOKEN ||
      null;

    if (!token) {
      return res
        .status(401)
        .json({
          ok: false,
          error: { code: "NO_REFRESH_TOKEN", message: "ไม่มี refresh token" },
        });
    }

    const result = await refreshService({ refreshToken: token });
    // ไม่ตั้ง cookie ใหม่ เพราะเราไม่ rotate refresh token
    res.json({
      ok: true,
      user: result.sessionUser,
      accessToken: result.tokens?.accessToken,
    });
  }),
];

// POST /api/auth/logout
export const logoutController = [
  asyncHandler(async (req, res) => {
    await logoutService();
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),
];

// GET /api/auth/me
export const meController = [
  asyncHandler(async (req, res) => {
    const id = Number(req.me?.id || req.user?.id || req.auth?.sub);
    if (!id) return res.json({ ok: true, isAuthenticated: false, user: null });
    const user = await meService({ userId: id });
    res.json({ ok: true, isAuthenticated: true, user });
  }),
];

// POST /api/auth/forgot
export const forgotPasswordController = [
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    await forgotPasswordService({ email });
    res.json({ ok: true });
  }),
];

// POST /api/auth/reset
export const resetPasswordController = [
  asyncHandler(async (req, res) => {
    const token = req.body?.token;
    const { newPassword } = req.body;
    await resetPasswordService({ token, newPassword });
    res.json({ ok: true });
  }),
];

// POST /api/auth/change-password
export const changePasswordController = [
  asyncHandler(async (req, res) => {
    const userId = Number(req.me?.id || req.user?.id || req.auth?.sub);
    await changePasswordService({
      userId,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
    });
    res.json({ ok: true });
  }),
];
