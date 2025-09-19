import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  sendMail,
  makeResetLink,
  renderForgotPasswordEmail,
  renderPasswordChangedEmail,
} from "../lib/mailer.js";

export const router = Router();

function genToken(len = 32) {
  return crypto.randomBytes(len).toString("hex");
}

/** POST /auth/login */
router.post("/login", async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ ok: false, error: "email & password required" });
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: {
      role: true,
      primaryUserDept: { include: { department: true } },
    },
  });
  if (!user)
    return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok)
    return res.status(401).json({ ok: false, error: "Invalid credentials" });

  // อายุ session
  req.sessionOptions.maxAge = (remember ? 7 : 1) * 24 * 60 * 60 * 1000;

  // เก็บ snapshot ลง session
  req.session.user = {
    id: user.id,
    name: user.name || "",
    email: user.email,
    roleId: user.roleId ?? null,
    roleName: (user.role?.name || "").toLowerCase(),
    primaryUserDeptId: user.primaryUserDeptId ?? null,
    deptCode: user.primaryUserDept?.department?.code ?? null,
  };

  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  return res.json({
    ok: true,
    data: {
      id: user.id,
      name: user.name || "",
      email: user.email,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      primaryUserDept: user.primaryUserDept
        ? {
            id: user.primaryUserDept.id,
            positionLevel: user.primaryUserDept.positionLevel,
            positionName: user.primaryUserDept.positionName,
            department: {
              id: user.primaryUserDept.department.id,
              code: user.primaryUserDept.department.code,
              nameTh: user.primaryUserDept.department.nameTh,
              nameEn: user.primaryUserDept.department.nameEn,
            },
          }
        : null,
    },
  });
});

/** GET /auth/me */
router.get("/me", async (req, res) => {
  const sess = req.session?.user;
  if (!sess?.id) {
    return res
      .status(200)
      .json({ ok: true, isAuthenticated: false, user: null });
  }
  const u = await prisma.user.findFirst({
    where: { id: sess.id, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      avatarPath: true,
      role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
      primaryUserDept: {
        select: {
          id: true,
          positionLevel: true,
          positionName: true,
          department: {
            select: { id: true, code: true, nameTh: true, nameEn: true },
          },
        },
      },
    },
  });
  if (!u)
    return res
      .status(401)
      .json({ ok: true, isAuthenticated: false, user: null });
  return res.json({ ok: true, isAuthenticated: true, user: u });
});

/** POST /auth/change-password */
router.post("/change-password", requireAuth, async (req, res) => {
  const t = (s = "") => String(s ?? "").trim();
  const currentPassword = t(req.body?.currentPassword);
  const newPassword = t(req.body?.newPassword);

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ ok: false, error: "currentPassword & newPassword required" });
  }
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ ok: false, error: "password must be at least 8 characters" });
  }

  const me = req.session.user;
  const u = await prisma.user.findUnique({ where: { id: me.id } });
  if (!u) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const ok = await bcrypt.compare(currentPassword, u.passwordHash || "");
  if (!ok)
    return res
      .status(400)
      .json({ ok: false, error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash } });

  // แจ้งทางอีเมล (best-effort)
  if (u.email) {
    try {
      const msg = renderPasswordChangedEmail({ name: u.name || "" });
      await sendMail({
        to: u.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
    } catch (err) {
      console.error("send password-changed email failed:", err);
    }
  }
  res.json({ ok: true });
});

/** POST /auth/forgot-password */
router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!email)
    return res.status(400).json({ ok: false, error: "email required" });

  const u = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true },
  });
  if (!u) return res.json({ ok: true }); // เงียบๆ เพื่อความปลอดภัย

  const token = genToken(24);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30m
  await prisma.passwordReset.create({
    data: { userId: u.id, token, expiresAt },
  });

  try {
    const link = makeResetLink(token);
    const msg = renderForgotPasswordEmail({ name: u.name || "", link });
    await sendMail({
      to: u.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
  } catch (err) {
    console.error("send forgot-password email failed:", err);
  }

  res.json({ ok: true });
});

/** POST /auth/reset-password */
router.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const newPassword = String(req.body?.newPassword || "").trim();
  if (!token || !newPassword)
    return res
      .status(400)
      .json({ ok: false, error: "token & newPassword required" });
  if (newPassword.length < 8)
    return res
      .status(400)
      .json({ ok: false, error: "password must be at least 8 characters" });

  const pr = await prisma.passwordReset.findFirst({
    where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  if (!pr)
    return res
      .status(400)
      .json({ ok: false, error: "Invalid or expired token" });

  const u = await prisma.user.findUnique({ where: { id: pr.userId } });
  if (!u) return res.status(400).json({ ok: false, error: "Invalid user" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: u.id }, data: { passwordHash } });
    await tx.passwordReset.update({
      where: { id: pr.id },
      data: { usedAt: new Date() },
    });
  });

  try {
    if (u.email) {
      const msg = renderPasswordChangedEmail({ name: u.name || "" });
      await sendMail({
        to: u.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
    }
  } catch (err) {
    console.error("send password-changed email failed:", err);
  }
  res.json({ ok: true });
});

export default router;
