import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  registerService,
  loginService,
  refreshService,
  logoutService,
  meService,
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
} from "../services/auth.service.js";

const isProd = process.env.NODE_ENV === "production";
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";
const ACCESS_TTL = Number(process.env.ACCESS_TTL_SEC || 900);
const REFRESH_TTL = Number(process.env.REFRESH_TTL_SEC || 604800);

function cookieBase() {
  return isProd
    ? { httpOnly: true, path: "/", sameSite: "none", secure: true }
    : { httpOnly: true, path: "/", sameSite: "lax", secure: false };
}
function setAuthCookies(res, tokens) {
  if (!tokens?.accessToken || !tokens?.refreshToken) return;
  const base = cookieBase();
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: (tokens.accessExp ?? ACCESS_TTL) * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: (tokens.refreshExp ?? REFRESH_TTL) * 1000,
  });
}
function clearAuthCookies(res) {
  const base = cookieBase();
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

/* ---------- Schemas ---------- */
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().optional(),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
const changePwdSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
});
const resetPwdSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

/* ---------- Handlers ---------- */

// POST /api/auth/register
export const registerController = [
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body ?? {});
    const result = await registerService({ payload });
    setAuthCookies(res, result.tokens);
    res.json({ ok: true, user: result.sessionUser, ...result.tokens });
  }),
];

// POST /api/auth/login
export const loginController = [
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body ?? {});
    const result = await loginService({ email, password });
    setAuthCookies(res, result.tokens);
    res.json({ ok: true, user: result.sessionUser, ...result.tokens });
  }),
];

// POST /api/auth/refresh
export const refreshController = [
  asyncHandler(async (req, res) => {
    const token =
      req.cookies?.[REFRESH_COOKIE] ||
      req.cookies?.refresh_token ||
      req.cookies?.refreshToken ||
      req.cookies?.REFRESH_TOKEN;
    if (!token)
      return res.status(401).json({ ok: false, error: "NO_REFRESH_TOKEN" });

    const result = await refreshService({ refreshToken: token });
    setAuthCookies(res, result.tokens);
    res.json({ ok: true, user: result.sessionUser, ...result.tokens });
  }),
];

// POST /api/auth/logout
export const logoutController = [
  asyncHandler(async (_req, res) => {
    await logoutService();
    clearAuthCookies(res);
    res.json({ ok: true });
  }),
];

// GET /api/auth/me
export const meController = [
  asyncHandler(async (req, res) => {
    const id =
      Number(req.user?.id) ||
      Number(req.userId) ||
      Number(req.auth?.sub) ||
      null;
    if (!id) return res.json({ ok: true, isAuthenticated: false, user: null });
    const user = await meService({ userId: id });
    res.json({ ok: true, isAuthenticated: true, user });
  }),
];

// POST /api/auth/forgot
export const forgotPasswordController = [
  asyncHandler(async (req, res) => {
    const { email } = z
      .object({ email: z.string().email() })
      .parse(req.body ?? {});
    await forgotPasswordService({ email });
    res.json({ ok: true });
  }),
];

// POST /api/auth/reset
export const resetPasswordController = [
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetPwdSchema.parse({
      ...req.body,
      token:
        req.body?.token ?? req.query?.token ?? req.headers["x-reset-token"],
    });
    await resetPasswordService({ token, newPassword });
    res.json({ ok: true });
  }),
];

// POST /api/auth/change-password
export const changePasswordController = [
  asyncHandler(async (req, res) => {
    const userId =
      Number(req.user?.id) || Number(req.userId) || Number(req.auth?.sub);
    if (!userId)
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const { currentPassword, newPassword } = changePwdSchema.parse(
      req.body ?? {}
    );
    await changePasswordService({ userId, currentPassword, newPassword });
    res.json({ ok: true });
  }),
];
