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

// helper: สุ่ม token ปลอดภัย
function genToken(len = 32) {
  return crypto.randomBytes(len).toString("hex"); // 64 chars
}

/**
 * POST /auth/login
 * body: { email, password, remember? }
 */
router.post("/login", async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ ok: false, error: "email & password required" });
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: { role: true, department: true },
  });
  if (!user)
    return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok)
    return res.status(401).json({ ok: false, error: "Invalid credentials" });

  req.sessionOptions.maxAge = (remember ? 7 : 1) * 24 * 60 * 60 * 1000;

  // เก็บข้อมูลจำเป็นลง session
  req.session.user = {
    id: user.id,
    name: user.name || "", // ✅ ใส่ชื่อเล่น/ชื่อแสดงผล
    email: user.email,
    roleId: user.roleId,
    roleName: user.role?.name,
    departmentId: user.departmentId,
    deptCode: user.department?.code,
  };

  // (ออปชัน) track last login
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  return res.json({
    ok: true,
    data: {
      id: user.id,
      name: user.name || "", // ✅ ส่ง name กลับ FE
      email: user.email,
      role: { id: user.roleId, name: user.role?.name },
      department: {
        id: user.departmentId,
        code: user.department?.code,
        nameTh: user.department?.nameTh,
        nameEn: user.department?.nameEn,
      },
    },
  });
});

/** POST /auth/logout */
router.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

/** GET /auth/me */
router.get("/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(200).json({ ok: true, isAuthenticated: false });
  }
  return res.json({ ok: true, isAuthenticated: true, user: req.session.user });
});

/** POST /auth/change-password  (ต้องล็อกอิน) */
router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ ok: false, error: "currentPassword & newPassword required" });
  }
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ ok: false, error: "newPassword must be at least 8 characters" });
  }

  const me = await prisma.user.findFirst({
    where: { id: req.session.user.id, deletedAt: null },
    select: { id: true, passwordHash: true, email: true, name: true },
  });
  if (!me) return res.status(404).json({ ok: false, error: "User not found" });

  const ok = await bcrypt.compare(currentPassword, me.passwordHash);
  if (!ok)
    return res
      .status(401)
      .json({ ok: false, error: "Invalid current password" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash } });

  // ส่งอีเมลยืนยันการเปลี่ยนรหัสผ่าน
  if (me.email) {
    try {
      const msg = renderPasswordChangedEmail({ name: me.name });
      await sendMail({
        to: me.email,
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

/**
 * POST /auth/register
 * body: {
 *   name?, email, password,
 *   firstNameTh?, lastNameTh?, firstNameEn?, lastNameEn?,
 *   departmentId
 * }
 * role เริ่มต้น: staff
 */
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      firstNameTh,
      lastNameTh,
      firstNameEn,
      lastNameEn,
      departmentId,
    } = req.body || {};

    if (!email || !password || !departmentId) {
      return res
        .status(400)
        .json({ ok: false, error: "email, password, departmentId required" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ ok: false, error: "password must be at least 8 characters" });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists && !exists.deletedAt) {
      return res.status(409).json({ ok: false, error: "Email already in use" });
    }

    const staffRole = await prisma.role.findUnique({
      where: { name: "staff" },
    });
    if (!staffRole) {
      return res.status(500).json({
        ok: false,
        error: 'Default role "staff" not found. Please seed roles.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ คิดชื่อแสดงผลอัตโนมัติถ้าไม่ส่ง name
    const displayName =
      (name ?? "").trim() ||
      [firstNameTh, lastNameTh].filter(Boolean).join(" ").trim() ||
      [firstNameEn, lastNameEn].filter(Boolean).join(" ").trim() ||
      "";

    const created = await prisma.user.create({
      data: {
        name: displayName, // ✅ เก็บชื่อเล่น/ชื่อแสดงผล
        email,
        passwordHash,
        firstNameTh: firstNameTh || "",
        lastNameTh: lastNameTh || "",
        firstNameEn: firstNameEn || "",
        lastNameEn: lastNameEn || "",
        roleId: staffRole.id,
        departmentId: Number(departmentId),
      },
      select: {
        id: true,
        name: true,
        email: true,
        firstNameTh: true,
        lastNameTh: true,
        firstNameEn: true,
        lastNameEn: true,
        role: { select: { id: true, name: true } },
        department: {
          select: { id: true, code: true, nameTh: true, nameEn: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({ ok: true, data: created });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * POST /auth/forgot-password
 * body: { email }
 * - สร้าง token อายุ 30 นาที เก็บในตาราง PasswordReset
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email)
    return res.status(400).json({ ok: false, error: "email required" });

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, name: true, email: true },
  });

  // เพื่อความปลอดภัย ตอบ 200 เสมอ แม้ไม่พบอีเมล
  if (!user) return res.json({ ok: true });

  const token = genToken(32);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 นาที

  await prisma.passwordReset.create({
    data: { userId: user.id, token, expiresAt },
  });

  try {
    const resetUrl = makeResetLink(token);
    const msg = renderForgotPasswordEmail({ name: user.name, resetUrl });
    await sendMail({
      to: user.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
  } catch (err) {
    // ไม่ทำให้ flow ล้ม ถ้าส่งเมลพลาด
    console.error("send forgot-password email failed:", err);
  }
  // DEV จะยังดู token ใน log ด้วยตัวเองได้หากต้องการ
  return res.json({ ok: true });
});

/**
 * POST /auth/reset-password
 * body: { token, password }
 */
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res
      .status(400)
      .json({ ok: false, error: "token & password required" });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ ok: false, error: "password must be at least 8 characters" });
  }

  const pr = await prisma.passwordReset.findFirst({
    where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  if (!pr)
    return res
      .status(400)
      .json({ ok: false, error: "Invalid or expired token" });

  const u = await prisma.user.findUnique({
    where: { id: pr.userId },
    select: { id: true, email: true, name: true },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: pr.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({
      where: { id: pr.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // ส่งอีเมลยืนยันหลังเปลี่ยนรหัสผ่าน
  if (u?.email) {
    try {
      const msg = renderPasswordChangedEmail({ name: u.name });
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

export default router;
