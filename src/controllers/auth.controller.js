// src/controllers/auth.controller.js
import { prisma } from "../prisma.js";
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

// ค่าจาก .env (วินาที)
const ACCESS_TTL = Number(process.env.ACCESS_TTL_SEC || 900);
const REFRESH_TTL = Number(process.env.REFRESH_TTL_SEC || 604800);

// คอนฟิกคุกกี้ให้ถูกบริบท: dev = Lax/!Secure, prod(HTTPS) = None/Secure
function cookieBase() {
  if (isProd) {
    return { httpOnly: true, path: "/", sameSite: "none", secure: true };
  }
  // dev: พอร์ต 3000 ↔ 4000 ถือว่า same-site ได้ ใช้ Lax จะติดคุกกี้แน่นอน
  return { httpOnly: true, path: "/", sameSite: "lax", secure: false };
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

function sendError(res, e, fallback = 400) {
  const msg = e?.message || "UNKNOWN_ERROR";
  const status =
    e?.status ??
    (msg === "LOGIN_FAILED"
      ? 401
      : msg === "INVALID_REFRESH"
      ? 401
      : msg === "USER_NOT_FOUND"
      ? 404
      : msg === "Email already in use"
      ? 409
      : fallback);
  return res.status(status).json({ ok: false, error: msg });
}

/** POST /auth/register */
export async function registerController(req, res) {
  try {
    const user = await registerService({ prisma, payload: req.body || {} });
    return res.json({ ok: true, user });
  } catch (e) {
    return sendError(res, e);
  }
}

/** POST /auth/login */
export async function loginController(req, res) {
  try {
    const { email, password } = req.body || {};
    const result = await loginService({ prisma, email, password });
    setAuthCookies(res, result.tokens);

    return res.json({
      ok: true,
      user: result.sessionUser,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      accessExp: result.tokens.accessExp,
      refreshExp: result.tokens.refreshExp,
    });
  } catch (e) {
    return sendError(res, e, 401);
  }
}

/** POST /auth/refresh */
export async function refreshController(req, res) {
  try {
    const token =
      req.cookies?.[REFRESH_COOKIE] ||
      req.cookies?.refresh_token ||
      req.cookies?.refreshToken ||
      req.cookies?.REFRESH_TOKEN;

    if (!token) {
      return res.status(401).json({ ok: false, error: "NO_REFRESH_TOKEN" });
    }

    const result = await refreshService({ prisma, refreshToken: token });
    setAuthCookies(res, result.tokens);

    return res.json({
      ok: true,
      user: result.sessionUser,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      accessExp: result.tokens.accessExp,
      refreshExp: result.tokens.refreshExp,
    });
  } catch (e) {
    clearAuthCookies(res);
    return sendError(res, e, 401);
  }
}

/** POST /auth/logout */
export async function logoutController(_req, res) {
  try {
    await logoutService();
  } catch {}
  clearAuthCookies(res);
  return res.json({ ok: true });
}

/** GET /auth/me */
export async function meController(req, res) {
  try {
    const id =
      Number(req.user?.id) || Number(req.userId) || Number(req.auth?.sub) || null;

    if (!id) {
      return res.json({ ok: true, isAuthenticated: false, user: null });
    }
    const user = await meService({ prisma, userId: id });
    return res.json({ ok: true, isAuthenticated: true, user });
  } catch (e) {
    return sendError(res, e, 401);
  }
}

/** POST /auth/forgot */
export async function forgotPasswordController(req, res) {
  try {
    const { email } = req.body || {};
    if (!email)
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    await forgotPasswordService({ prisma, email });
    return res.json({ ok: true });
  } catch (e) {
    return sendError(res, e);
  }
}

/** POST /auth/reset */
export async function resetPasswordController(req, res) {
  try {
    const body = req.body || {};
    const token = body.token || req.query?.token || req.headers["x-reset-token"];
    const newPassword = body.newPassword || body.password;
    const confirm = body.confirmPassword ?? body.newPasswordConfirm;

    if (!token || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: "ต้องการข้อมูลเพิ่มเติม",
        details: { need: ["token", "newPassword"] },
      });
    }
    if (confirm !== undefined && confirm !== null && confirm !== newPassword) {
      return res
        .status(400)
        .json({ ok: false, error: "รหัสผ่านไม่ตรงกัน", details: { confirm } });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({
        ok: false,
        error: "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร",
        details: { minLength: 8 },
      });
    }

    await resetPasswordService({ prisma, token, newPassword });
    return res.json({ ok: true });
  } catch (e) {
    const raw = String(e?.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    let error = raw;
    if (/TOKEN_INVALID/i.test(raw)) error = "โทเค็นไม่ถูกต้อง";
    else if (/TOKEN_EXPIRED/i.test(raw)) error = "โทเค็นหมดอายุ";
    else if (/TOKEN_ALREADY_USED/i.test(raw)) error = "โทเค็นถูกใช้แล้ว";
    else if (/TOKEN_OR_PASSWORD_REQUIRED/i.test(raw))
      error = "ต้องการข้อมูลเพิ่มเติม";
    else if (/PASSWORD_TOO_SHORT/i.test(raw))
      error = "รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร";
    return res.status(400).json({ ok: false, error });
  }
}

/** POST /auth/change-password (protected) */
export async function changePasswordController(req, res) {
  try {
    const userId = Number(req.user?.id) || Number(req.userId) || Number(req.auth?.sub);
    if (!userId)
      return res.status(401).json({ ok: false, error: "ไม่มีสิทธิ์เข้าใช้งาน" });

    const { currentPassword, newPassword } = req.body || {};
    await changePasswordService({ prisma, userId, currentPassword, newPassword });
    return res.json({ ok: true });
  } catch (e) {
    return sendError(res, e);
  }
}
