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
    include: { role: true, department: true },
  });
  if (!user)
    return res.status(401).json({ ok: false, error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok)
    return res.status(401).json({ ok: false, error: "Invalid credentials" });

  // อายุ session
  req.sessionOptions.maxAge = (remember ? 7 : 1) * 24 * 60 * 60 * 1000;

  // เก็บ snapshot ที่จำเป็นลง session (roleName ให้เป็น lower-case เสมอ)
  req.session.user = {
    id: user.id,
    name: user.name || "",
    email: user.email,
    roleId: user.roleId ?? null,
    roleName: (user.role?.name || "").toLowerCase(), // 👈 สำคัญ
    departmentId: user.departmentId ?? null,
    deptCode: user.department?.code || null,
  };

  // (ออปชัน) track last login
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  // ส่งข้อมูลเต็มให้ FE ใช้ได้ทันที
  return res.json({
    ok: true,
    data: {
      id: user.id,
      name: user.name || "",
      email: user.email,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      department: user.department
        ? {
            id: user.department.id,
            code: user.department.code,
            nameTh: user.department.nameTh,
            nameEn: user.department.nameEn,
          }
        : null,
    },
  });
});

/** POST /auth/logout */
router.post("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

/** GET /auth/me — คืน user จาก DB (รวม role+department) เพื่อ FE เช็คสิทธิ์ได้แน่ */
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
      department: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
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
  const t = (s = "") => String(s ?? "").trim(); // normalize
  const currentPassword = t(req.body?.currentPassword);
  const newPassword = t(req.body?.newPassword);

  // ---------- Validation ----------
  const errors = {};
  if (!currentPassword) errors.currentPassword = "กรุณากรอกรหัสผ่านปัจจุบัน";
  if (!newPassword) errors.newPassword = "กรุณากรอกรหัสผ่านใหม่";
  if (newPassword && newPassword.length < 8) {
    errors.newPassword = "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร";
  }
  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.newPassword = "รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านปัจจุบัน";
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "กรุณาตรวจสอบข้อมูลที่กรอก",
      message_en: "Please check the fields you entered.",
      errors,
      fields: Object.keys(errors),
    });
  }

  try {
    // ---------- Load user ----------
    const me = await prisma.user.findFirst({
      where: { id: req.session.user.id, deletedAt: null },
      select: { id: true, passwordHash: true, email: true, name: true },
    });
    if (!me) {
      return res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        message: "ไม่พบผู้ใช้",
        message_en: "User not found.",
      });
    }

    // ---------- Verify current password ----------
    const passOk = await bcrypt.compare(currentPassword, me.passwordHash || "");
    if (!passOk) {
      // ให้เป็น validation error ที่ผูกกับฟิลด์ จะได้โชว์ใต้ช่องได้
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
        message_en: "Current password is incorrect.",
        errors: { currentPassword: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
        fields: ["currentPassword"],
      });
    }

    // ---------- Update ----------
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash } });

    // (ออปชัน) คุณอาจ revoke session อื่น ๆ ที่นี่เพื่อความปลอดภัย
    // await revokeOtherSessions(me.id, req.session.id)

    // ---------- Notify by email (best-effort) ----------
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
        // ไม่ fail request ถ้าเมลส่งไม่สำเร็จ
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("change-password error:", err);
    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "เกิดข้อผิดพลาดภายในระบบ",
      message_en: "Something went wrong on the server.",
    });
  }
});

/** POST /auth/register */
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
      return res
        .status(500)
        .json({
          ok: false,
          error: 'Default role "staff" not found. Please seed roles.',
        });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName =
      (name ?? "").trim() ||
      [firstNameTh, lastNameTh].filter(Boolean).join(" ").trim() ||
      [firstNameEn, lastNameEn].filter(Boolean).join(" ").trim() ||
      "";

    const created = await prisma.user.create({
      data: {
        name: displayName,
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

/** POST /auth/forgot-password */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email)
    return res.status(400).json({ ok: false, error: "email required" });

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, name: true, email: true },
  });

  // เพื่อลดข้อมูลรั่ว ตอบ 200 เสมอ
  if (!user) return res.json({ ok: true });

  const token = genToken(32);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

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
    console.error("send forgot-password email failed:", err);
  }
  return res.json({ ok: true });
});

/** POST /auth/reset-password */
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
