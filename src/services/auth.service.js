// src/services/auth.service.js
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendMail, makeResetLink, renderForgotPasswordEmail, renderPasswordChangedEmail } from "../lib/mailer.js";

const ACCESS_TTL_SEC  = Number(process.env.ACCESS_TTL_SEC  || 15 * 60);     // 15 นาที
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TTL_SEC || 7 * 24 * 3600); // 7 วัน
const JWT_ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || "dev-access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

/** -------- helpers (token) -------- */
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });
}
export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC });
}
export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

/** คืนข้อมูล user แบบปลอดภัยสำหรับ session/me */
function toSessionUser(u) {
  return {
    id: u.id,
    email: u.email,
    roleName: u.role?.name || null,
    // primary dept (ถ้ามี)
    primaryDeptId: u.primaryUserDept?.department?.id ?? null,
    primaryDeptCode: u.primaryUserDept?.department?.code ?? null,
    primaryLevel: u.primaryUserDept?.positionLevel ?? null,
    primaryPosition: u.primaryUserDept?.positionName ?? null,
    // รายชื่อแผนกที่ active ทั้งหมด (ให้ middleware ใช้)
    departments: (u.userDepartments || []).map((ud) => ({
      id: ud.department.id,
      code: ud.department.code,
      nameTh: ud.department.nameTh,
      nameEn: ud.department.nameEn,
      level: ud.positionLevel,
      position: ud.positionName || null,
    })),
  };
}

/** ดึง user + role + primary dept + all active depts */
async function getUserForSession(prisma, id) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, email: true,
      role: { select: { name: true } },
      primaryUserDept: {
        select: {
          positionLevel: true, positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } }
        }
      },
      userDepartments: {
        where: { endedAt: null },
        select: {
          positionLevel: true, positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } }
        }
      }
    }
  });
}

/** -------- register --------
 * สร้างผู้ใช้ใหม่ (role = user), เข้าสู่ระบบให้เลย, คืน access/refresh
 */
export async function registerService({ prisma, payload }) {
  const { email, password, firstNameTh, lastNameTh, firstNameEn = "", lastNameEn = "", orgId = null } = payload || {};
  if (!email || !password || !firstNameTh || !lastNameTh) {
    throw new Error("MISSING_REQUIRED_FIELDS");
  }

  const dup = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } });
  if (dup) throw new Error("Email already in use");

  const roleUser = await prisma.role.findUnique({ where: { name: "user" } });
  if (!roleUser) throw new Error("ROLE_USER_MISSING");

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstNameTh, lastNameTh,
      firstNameEn, lastNameEn,
      roleId: roleUser.id,
      orgId,
      // fields อื่น ๆ ให้ปรับเพิ่มที่หน้า Profile ภายหลัง
      name: `${firstNameEn} ${lastNameEn}`.trim(),
      startDate: new Date(),
    },
    select: { id: true }
  });

  const u = await getUserForSession(prisma, created.id);
  const sessionUser = toSessionUser(u);

  const accessToken  = signAccessToken({ sub: u.id, role: u.role?.name || "user" });
  const refreshToken = signRefreshToken({ sub: u.id });

  return { sessionUser, tokens: { accessToken, refreshToken, accessExp: ACCESS_TTL_SEC, refreshExp: REFRESH_TTL_SEC } };
}

/** -------- login -------- */
export async function loginService({ prisma, email, password }) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, passwordHash: true, role: { select: { name: true } } }
  });
  if (!user) throw new Error("LOGIN_FAILED");
  const ok = await bcrypt.compare(password || "", user.passwordHash || "");
  if (!ok) throw new Error("LOGIN_FAILED");

  const u = await getUserForSession(prisma, user.id);
  const sessionUser = toSessionUser(u);

  const accessToken  = signAccessToken({ sub: u.id, role: u.role?.name || "user" });
  const refreshToken = signRefreshToken({ sub: u.id });

  return { sessionUser, tokens: { accessToken, refreshToken, accessExp: ACCESS_TTL_SEC, refreshExp: REFRESH_TTL_SEC } };
}

/** -------- refresh -------- */
export async function refreshService({ prisma, refreshToken }) {
  const decoded = verifyRefreshToken(refreshToken);
  const id = decoded?.sub;
  if (!id) throw new Error("INVALID_REFRESH");

  const u = await getUserForSession(prisma, Number(id));
  if (!u) throw new Error("USER_NOT_FOUND");

  const sessionUser = toSessionUser(u);
  const accessToken  = signAccessToken({ sub: u.id, role: u.role?.name || "user" });
  const newRefresh   = signRefreshToken({ sub: u.id });

  return { sessionUser, tokens: { accessToken, refreshToken: newRefresh, accessExp: ACCESS_TTL_SEC, refreshExp: REFRESH_TTL_SEC } };
}

/** -------- logout -------- */
export async function logoutService() {
  return { ok: true };
}

/** -------- forgot / reset / change password -------- */
export async function forgotPasswordService({ prisma, email }) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, firstNameTh: true, firstNameEn: true, email: true },
  });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = makeResetLink(token);
    const { subject, html, text } = renderForgotPasswordEmail({
      name: user.firstNameTh || user.firstNameEn || "",
      resetUrl,
    });

    try { await sendMail({ to: user.email, subject, html, text }); } catch (_) {}
  }
  return { ok: true };
}

export async function resetPasswordService({ prisma, token, newPassword }) {
  if (!token || !newPassword) {
    throw new Error("TOKEN_OR_PASSWORD_REQUIRED");
  }

  // หา record โทเค็น
  const rec = await prisma.passwordReset.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstNameTh: true,
          firstNameEn: true,
        },
      },
    },
  });

  if (!rec) throw new Error("TOKEN_INVALID");
  if (rec.usedAt) throw new Error("TOKEN_ALREADY_USED");
  if (rec.expiresAt && rec.expiresAt.getTime() < Date.now()) {
    throw new Error("TOKEN_EXPIRED");
  }

  // hash password ใหม่
  const hash = await bcrypt.hash(newPassword, 10);

  // อัปเดตภายใน transaction เดียว
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: rec.userId },
      data: { passwordHash: hash },
    });

    await tx.passwordReset.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    // (ออปชัน) ทำให้โทเค็นรีเซ็ตคงค้างของ user เดียวกันหมดอายุ/ใช้ไม่ได้
    await tx.passwordReset.updateMany({
      where: {
        userId: rec.userId,
        usedAt: null,
        NOT: { token },
      },
      data: {
        expiresAt: new Date(0), // หมดอายุย้อนหลัง
      },
    });
  });

  // ส่งอีเมลแจ้ง password ถูกเปลี่ยน (ไม่ให้ล้ม flow ถ้าส่งอีเมลล้มเหลว)
  try {
    const name = rec.user.firstNameTh || rec.user.firstNameEn || "";
    const { subject, html, text } = renderPasswordChangedEmail({ name });
    await sendMail({ to: rec.user.email, subject, html, text });
  } catch {
    // เงียบ ๆ ไม่ throw เพื่อไม่ให้กระทบผู้ใช้
  }

  return { ok: true };
}

export async function changePasswordService({ prisma, userId, currentPassword, newPassword }) {
  if (!userId) throw new Error("UNAUTHORIZED");
  if (!newPassword) throw new Error("NEW_PASSWORD_REQUIRED");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true, firstNameTh: true, firstNameEn: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  if (!currentPassword) throw new Error("CURRENT_PASSWORD_REQUIRED");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash || "");
  if (!ok) throw new Error("CURRENT_PASSWORD_INCORRECT");

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

  try {
    const { subject, html, text } = renderPasswordChangedEmail({
      name: user.firstNameTh || user.firstNameEn || "",
    });
    await sendMail({ to: user.email, subject, html, text });
  } catch (_) {}

  return { ok: true };
}

/** -------- me -------- */
export async function meService({ prisma, userId }) {
  const u = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true, email: true, name: true, avatarPath: true,
      role: { select: { name: true, labelTh: true, labelEn: true } },
      organization: { select: { id: true, code: true, nameTh: true, nameEn: true } },
      primaryUserDept: {
        select: {
          id: true, positionLevel: true, positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } }
        }
      },
      userDepartments: {
        where: { endedAt: null },
        select: {
          positionLevel: true, positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } }
        }
      },
      employeeCode: true, employeeType: true, contractType: true,
      startDate: true, probationEndDate: true, resignedAt: true, birthDate: true, gender: true,
    }
  });
  if (!u) throw new Error("USER_NOT_FOUND");
  return u;
}
