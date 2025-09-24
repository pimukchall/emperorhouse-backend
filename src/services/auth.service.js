import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  sendMail,
  makeResetLink,
  renderForgotPasswordEmail,
  renderPasswordChangedEmail,
} from "../lib/mailer.js";
import { genEmployeeCode } from "./users.service.js"; // ใช้ generator เลขพนักงาน

const ACCESS_TTL_SEC = Number(process.env.ACCESS_TTL_SEC || 15 * 60); // 15 นาที
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TTL_SEC || 7 * 24 * 3600); // 7 วัน
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

/* ---------------- Token helpers ---------------- */
export function signAccessToken(payload) {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });
}
export function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC });
}
export function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

/* ---------------- Session shaping ---------------- */
function toSessionUser(u) {
  return {
    id: u.id,
    email: u.email,
    roleName: u.role?.name || null,
    // primary dept snapshot
    primaryDeptId: u.primaryUserDept?.department?.id ?? null,
    primaryDeptCode: u.primaryUserDept?.department?.code ?? null,
    primaryLevel: u.primaryUserDept?.positionLevel ?? null,
    primaryPosition: u.primaryUserDept?.positionName ?? null,
    // active departments for middleware
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

async function getUserForSession(prisma, id) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      role: { select: { name: true } },
      primaryUserDept: {
        select: {
          positionLevel: true,
          positionName: true,
          department: {
            select: { id: true, code: true, nameTh: true, nameEn: true },
          },
        },
      },
      userDepartments: {
        where: { endedAt: null, isActive: true, isActive: true },
        select: {
          positionLevel: true,
          positionName: true,
          department: {
            select: { id: true, code: true, nameTh: true, nameEn: true },
          },
        },
      },
    },
  });
}

/* ---------------- Register ---------------- */
// ใช้กับ controller ที่เรียก registerService({ prisma, payload: req.body })
export async function registerService({ prisma, payload }) {
  const email = String(payload?.email ?? "").trim();
  const password = String(payload?.password ?? "").trim();
  const name = String(payload?.name ?? "").trim(); // optional

  if (!email || !password) {
    if (!email && !password) throw new Error("ไม่พบอีเมลและรหัสผ่าน");
    if (!email) throw new Error("ไม่พบอีเมล");
    throw new Error("ไม่พบรหัสผ่าน");
  }

  // ป้องกันอีเมลซ้ำ
  const exists = await prisma.user.findFirst({ where: { email } });
  if (exists) throw new Error("อีเมลนี้ถูกใช้งานแล้ว");

  const passwordHash = await bcrypt.hash(password, 10);

  // ใช้ transaction กัน race ตอน gen employeeCode
  const created = await prisma.$transaction(async (tx) => {
    // สมัคร user ขั้นต้น
    const u = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        roleId: 2, // กำหนด default role = user (id=2)
        firstNameTh: payload.firstNameTh ?? "",
        lastNameTh: payload.lastNameTh ?? "",
        firstNameEn: payload.firstNameEn ?? "",
        lastNameEn: payload.lastNameEn ?? "",
      },
    });

    // ถ้าไม่มี employeeCode ให้ gen เริ่มต้น (default ตาม genEmployeeCode → fallback = "C-")
    if (!u.employeeCode || String(u.employeeCode).trim() === "") {
      const empCode = await genEmployeeCode(tx, null);
      await tx.user.update({
        where: { id: u.id },
        data: { employeeCode: empCode },
      });
    }

    // ส่งกลับพร้อมความสัมพันธ์ที่ frontend ใช้
    return tx.user.findUnique({
      where: { id: u.id },
      include: {
        role: true,
        organization: true,
        primaryUserDept: { include: { department: true } },
        userDepartments: { include: { department: true } },
      },
    });
  });

  return created;
}

/* ---------------- Login ---------------- */
export async function loginService({ prisma, email, password }) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, passwordHash: true, role: { select: { name: true } } },
  });
  if (!user) throw new Error("ไม่สามารถเข้าสู่ระบบได้");

  const ok = await bcrypt.compare(password || "", user.passwordHash || "");
  if (!ok) throw new Error("ไม่สามารถเข้าสู่ระบบได้");

  const u = await getUserForSession(prisma, user.id);
  const sessionUser = toSessionUser(u);

  const accessToken = signAccessToken({ sub: u.id, role: u.role?.name || "user" });
  const refreshToken = signRefreshToken({ sub: u.id });

  return {
    sessionUser,
    tokens: {
      accessToken,
      refreshToken,
      accessExp: ACCESS_TTL_SEC,
      refreshExp: REFRESH_TTL_SEC,
    },
  };
}

/* ---------------- Refresh ---------------- */
export async function refreshService({ prisma, refreshToken }) {
  const decoded = verifyRefreshToken(refreshToken);
  const id = decoded?.sub;
  if (!id) throw new Error("ไม่สามารถต่ออายุการเข้าสู่ระบบได้");

  const u = await getUserForSession(prisma, Number(id));
  if (!u) throw new Error("ไม่พบข้อมูลผู้ใช้");

  const sessionUser = toSessionUser(u);
  const accessToken = signAccessToken({ sub: u.id, role: u.role?.name || "user" });
  const newRefresh = signRefreshToken({ sub: u.id });

  return {
    sessionUser,
    tokens: {
      accessToken,
      refreshToken: newRefresh,
      accessExp: ACCESS_TTL_SEC,
      refreshExp: REFRESH_TTL_SEC,
    },
  };
}

/* ---------------- Logout ---------------- */
export async function logoutService() {
  return { ok: true };
}

/* ---------------- Forgot / Reset / Change password ---------------- */
export async function forgotPasswordService({ prisma, email }) {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, firstNameTh: true, firstNameEn: true, email: true },
  });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 นาที
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });

    const resetUrl = makeResetLink(token);
    const { subject, html, text } = renderForgotPasswordEmail({
      name: user.firstNameTh || user.firstNameEn || "",
      resetUrl,
    });

    try {
      await sendMail({ to: user.email, subject, html, text });
    } catch {}
  }
  return { ok: true };
}

export async function resetPasswordService({ prisma, token, newPassword }) {
  if (!token || !newPassword) throw new Error("ต้องระบุ token และรหัสผ่านใหม่");

  const rec = await prisma.passwordReset.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, email: true, firstNameTh: true, firstNameEn: true } },
    },
  });

  if (!rec) throw new Error("โทเค็นไม่ถูกต้อง");
  if (rec.usedAt) throw new Error("โทเค็นถูกใช้งานแล้ว");
  if (rec.expiresAt && rec.expiresAt.getTime() < Date.now()) {
    throw new Error("โทเค็นหมดอายุ");
  }

  const hash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: rec.userId }, data: { passwordHash: hash } });
    await tx.passwordReset.update({ where: { token }, data: { usedAt: new Date() } });
    await tx.passwordReset.updateMany({
      where: { userId: rec.userId, usedAt: null, NOT: { token } },
      data: { expiresAt: new Date(0) },
    });
  });

  try {
    const name = rec.user.firstNameTh || rec.user.firstNameEn || "";
    const { subject, html, text } = renderPasswordChangedEmail({ name });
    await sendMail({ to: rec.user.email, subject, html, text });
  } catch {}

  return { ok: true };
}

export async function changePasswordService({ prisma, userId, currentPassword, newPassword }) {
  if (!userId) throw new Error("ไม่พบผู้ใช้");
  if (!newPassword) throw new Error("ต้องระบุรหัสผ่านใหม่");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true, firstNameTh: true, firstNameEn: true },
  });
  if (!user) throw new Error("ไม่พบผู้ใช้");

  if (!currentPassword) throw new Error("ต้องระบุรหัสผ่านปัจจุบัน");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash || "");
  if (!ok) throw new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง");

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });

  try {
    const { subject, html, text } = renderPasswordChangedEmail({
      name: user.firstNameTh || user.firstNameEn || "",
    });
    await sendMail({ to: user.email, subject, html, text });
  } catch {}

  return { ok: true };
}

/* ---------------- Me ---------------- */
export async function meService({ prisma, userId }) {
  const u = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      avatarPath: true,
      role: { select: { name: true, labelTh: true, labelEn: true } },
      organization: { select: { id: true, code: true, nameTh: true, nameEn: true } },
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
      userDepartments: {
        where: { endedAt: null, isActive: true, isActive: true },
        select: {
          positionLevel: true,
          positionName: true,
          department: {
            select: { id: true, code: true, nameTh: true, nameEn: true },
          },
        },
      },
      employeeCode: true,
      employeeType: true,
      contractType: true,
      startDate: true,
      probationEndDate: true,
      resignedAt: true,
      birthDate: true,
      gender: true,
    },
  });
  if (!u) throw new Error("ไม่พบข้อมูลผู้ใช้");
  return u;
}
