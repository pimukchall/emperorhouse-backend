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

/** ตั้ง refresh cookie httpOnly */
function setRefreshCookie(res, token, maxAgeSec) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: !!(process.env.COOKIE_SECURE === "true"),
    sameSite: "lax",
    path: "/auth",
    maxAge: maxAgeSec * 1000,
  });
}

export async function registerController(req, res) {
  try {
    const { sessionUser, tokens } = await registerService({ prisma, payload: req.body || {} });
    req.session.user = sessionUser;
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExp);
    res.json({ ok: true, accessToken: tokens.accessToken, exp: tokens.accessExp, user: sessionUser });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

export async function loginController(req, res) {
  try {
    const { email, password } = req.body || {};
    const { sessionUser, tokens } = await loginService({ prisma, email, password });
    req.session.user = sessionUser;
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExp);
    res.json({ ok: true, accessToken: tokens.accessToken, exp: tokens.accessExp, user: sessionUser });
  } catch (_e) {
    res.status(401).json({ ok: false, error: "Login failed" });
  }
}

export async function refreshController(req, res) {
  try {
    const rt = req.cookies?.refresh_token;
    if (!rt) return res.status(401).json({ ok: false, error: "No refresh token" });

    const { sessionUser, tokens } = await refreshService({ prisma, refreshToken: rt });
    req.session.user = sessionUser;
    setRefreshCookie(res, tokens.refreshToken, tokens.refreshExp);
    res.json({ ok: true, accessToken: tokens.accessToken, exp: tokens.accessExp, user: sessionUser });
  } catch (_e) {
    res.status(401).json({ ok: false, error: "Refresh failed" });
  }
}

export async function logoutController(_req, res) {
  try {
    await logoutService();
    // clear cookie + destroy session
    res.clearCookie("refresh_token", { path: "/auth" });
    if (_req.session) {
      _req.session.destroy(() => {});
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

/** ✅ ส่ง response ได้ทั้งแบบเก่า (data) และแบบใหม่ (user,isAuthenticated) */
export async function meController(req, res) {
  try {
    const id = req.session?.user?.id;
    if (!id) {
      return res.json({ ok: true, isAuthenticated: false, user: null, data: null });
    }
    const data = await meService({ prisma, userId: id });
    return res.json({ ok: true, isAuthenticated: true, user: data, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

export async function forgotPasswordController(req, res) {
  try {
    await forgotPasswordService({ prisma, email: req.body?.email });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

export async function resetPasswordController(req, res) {
  try {
    const body = req.body || {};
    const token =
      body.token ||
      req.query?.token ||
      req.headers["x-reset-token"];

    const newPassword = body.newPassword || body.password;
    const confirm = body.confirmPassword ?? body.newPasswordConfirm;

    // ตรวจว่ามาครบ
    if (!token || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: "TOKEN_OR_PASSWORD_REQUIRED",
        details: {
          need: ["token", "newPassword"],
          got: { token: !!token, newPassword: !!newPassword },
        },
      });
    }

    // ถ้าส่ง confirm มา ให้ต้องตรงกัน
    if (confirm !== undefined && confirm !== null && confirm !== newPassword) {
      return res.status(400).json({
        ok: false,
        error: "PASSWORD_CONFIRM_MISMATCH",
      });
    }

    // เช็คความยาวขั้นต่ำ (ปรับตามนโยบายของคุณได้)
    if (String(newPassword).length < 8) {
      return res.status(400).json({
        ok: false,
        error: "PASSWORD_TOO_SHORT",
        details: { minLength: 8 },
      });
    }

    await resetPasswordService({ prisma, token, newPassword });
    return res.json({ ok: true });
  } catch (e) {
    // ทำให้ error อ่านง่าย/สม่ำเสมอ
    const raw = String(e?.message || "RESET_FAILED");
    let error = raw;

    if (/TOKEN_INVALID/i.test(raw)) error = "TOKEN_INVALID";
    else if (/TOKEN_EXPIRED/i.test(raw)) error = "TOKEN_EXPIRED";
    else if (/TOKEN_ALREADY_USED/i.test(raw)) error = "TOKEN_ALREADY_USED";
    else if (/TOKEN_OR_PASSWORD_REQUIRED/i.test(raw)) error = "TOKEN_OR_PASSWORD_REQUIRED";
    else if (/PASSWORD_TOO_SHORT/i.test(raw)) error = "PASSWORD_TOO_SHORT";
    else error = raw; // อื่น ๆ คงเดิม

    return res.status(400).json({ ok: false, error });
  }
}

export async function changePasswordController(req, res) {
  try {
    const userId = req.session?.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const { currentPassword, newPassword } = req.body || {};
    await changePasswordService({ prisma, userId, currentPassword, newPassword });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}
