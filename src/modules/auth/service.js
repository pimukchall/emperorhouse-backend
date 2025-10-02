import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma as defaultPrisma } from "#lib/prisma.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "#lib/tokens.js";
import {
  sendMail,
  makeResetLink,
  renderForgotPasswordEmail,
  renderPasswordChangedEmail,
} from "#lib/mailer.js";
import { AppError } from "#utils/appError.js";

/* ---------------- helpers ---------------- */
function toSessionUser(u) {
  const p = u.primaryUserDept;
  return {
    id: u.id,
    email: u.email,
    name: u.name || "",
    avatarPath: u.avatarPath || null,
    roleName: u.role?.name || "user",
    organization: u.organization
      ? {
          id: u.organization.id,
          code: u.organization.code,
          nameTh: u.organization.nameTh,
          nameEn: u.organization.nameEn,
        }
      : null,
    primary: p
      ? {
          level: p.positionLevel,
          position: p.positionName || null,
          department: p.department
            ? {
                id: p.department.id,
                code: p.department.code,
                nameTh: p.department.nameTh,
                nameEn: p.department.nameEn,
              }
            : null,
        }
      : null,
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
      name: true,
      avatarPath: true,
      role: { select: { name: true } },
      organization: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
      },
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
        where: { endedAt: null, isActive: true },
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

function issueTokens(u) {
  const accessToken = signAccessToken({
    sub: u.id,
    role: u.role?.name || "user",
  });
  const refreshToken = signRefreshToken({ sub: u.id }); // stateless cookie
  return { accessToken, refreshToken };
}

/* ---------------- Register ---------------- */
export async function registerService({ prisma = defaultPrisma, payload }) {
  const email = String(payload?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(payload?.password ?? "").trim();
  const name = String(payload?.name ?? "").trim();

  if (!email || !password) {
    if (!email && !password) throw AppError.badRequest("ไม่พบอีเมลและรหัสผ่าน");
    if (!email) throw AppError.badRequest("ไม่พบอีเมล");
    throw AppError.badRequest("ไม่พบรหัสผ่าน");
  }

  const exists = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (exists) throw AppError.conflict("อีเมลนี้ถูกใช้งานแล้ว");

  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const passwordHash = await bcrypt.hash(password, rounds);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: {
        connectOrCreate: {
          where: { name: "user" },
          create: { name: "user", labelTh: "ผู้ใช้", labelEn: "User" },
        },
      },
      firstNameTh: payload.firstNameTh ?? "",
      lastNameTh: payload.lastNameTh ?? "",
      firstNameEn: payload.firstNameEn ?? "",
      lastNameEn: payload.lastNameEn ?? "",
    },
  });

  const u = await getUserForSession(prisma, user.id);
  const sessionUser = toSessionUser(u);

  return { sessionUser, tokens: issueTokens(u) };
}

/* ---------------- Login ---------------- */
export async function loginService({
  prisma = defaultPrisma,
  email,
  password,
}) {
  const user = await prisma.user.findFirst({
    where: { email: String(email || "").toLowerCase(), deletedAt: null },
    select: {
      id: true,
      email: true,
      role: { select: { name: true } },
      passwordHash: true,
    },
  });
  if (!user) throw AppError.unauthorized("อีเมลหรือรหัสผ่านไม่ถูกต้อง");

  const ok = await bcrypt.compare(
    String(password || ""),
    user.passwordHash || ""
  );
  if (!ok) throw AppError.unauthorized("อีเมลหรือรหัสผ่านไม่ถูกต้อง");

  const u = await getUserForSession(prisma, user.id);
  const sessionUser = toSessionUser(u);

  return { sessionUser, tokens: issueTokens(u) };
}

/* ---------------- Refresh ---------------- */
export async function refreshService({ prisma = defaultPrisma, refreshToken }) {
  if (!refreshToken) throw AppError.unauthorized("กรุณาเข้าสู่ระบบ");
  try {
    const decoded = verifyRefreshToken(refreshToken); // แค่ verify แบบ stateless
    const id = Number(decoded?.sub);
    if (!id) throw AppError.unauthorized("โทเคนไม่ถูกต้อง");

    const u = await getUserForSession(prisma, id);
    if (!u) throw AppError.unauthorized("บัญชีผู้ใช้ไม่พร้อมใช้งานแล้ว");

    const sessionUser = toSessionUser(u);
    const accessToken = signAccessToken({
      sub: u.id,
      role: u.role?.name || "user",
    });

    // ไม่ออก refresh ใหม่ -> cookie เดิมอยู่จนหมดอายุ
    return { sessionUser, tokens: { accessToken } };
  } catch (err) {
    throw AppError.unauthorized("โทเคนหมดอายุหรือไม่ถูกต้อง");
  }
}

/* ---------------- Logout ---------------- */
export async function logoutService() {
  // แบบ stateless: แค่ลบ cookie ฝั่ง controller ก็พอ
  return { ok: true };
}

/* ---------------- Forgot / Reset / Change password ---------------- */
export async function forgotPasswordService({ prisma = defaultPrisma, email }) {
  const user = await prisma.user.findFirst({
    where: { email: String(email || "").toLowerCase(), deletedAt: null },
    select: { id: true, firstNameTh: true, firstNameEn: true, email: true },
  });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 นาที
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = makeResetLink(token);
    const { subject, html, text } = renderForgotPasswordEmail({
      name: user.firstNameTh || user.firstNameEn || "",
      resetUrl,
    });
    try {
      await sendMail({ to: user.email, subject, html, text });
    } catch (err) {
      console.error("sendMail(forgot) failed:", err);
    }
  }
  return { ok: true };
}

export async function resetPasswordService({
  prisma = defaultPrisma,
  token,
  newPassword,
}) {
  if (!token || !newPassword)
    throw AppError.badRequest("ต้องระบุ token และรหัสผ่านใหม่");

  const rec = await prisma.passwordReset.findUnique({
    where: { token },
    include: {
      user: {
        select: { id: true, email: true, firstNameTh: true, firstNameEn: true },
      },
    },
  });
  if (!rec) throw AppError.badRequest("โทเคนไม่ถูกต้อง");
  if (rec.usedAt) throw AppError.badRequest("โทเคนถูกใช้งานแล้ว");
  if (rec.expiresAt && rec.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest("โทเคนหมดอายุ");
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const hash = await bcrypt.hash(String(newPassword), rounds);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: rec.userId },
      data: { passwordHash: hash },
    });
    await tx.passwordReset.update({
      where: { token },
      data: { usedAt: new Date() },
    });
    await tx.passwordReset.updateMany({
      where: { userId: rec.userId, usedAt: null, NOT: { token } },
      data: { expiresAt: new Date(0) },
    });
  });

  try {
    const name = rec.user.firstNameTh || rec.user.firstNameEn || "";
    const { subject, html, text } = renderPasswordChangedEmail({ name });
    await sendMail({ to: rec.user.email, subject, html, text });
  } catch (err) {
    console.error("sendMail(reset) failed:", err);
  }

  return { ok: true };
}

export async function changePasswordService({
  prisma = defaultPrisma,
  userId,
  currentPassword,
  newPassword,
}) {
  if (!userId) throw AppError.badRequest("ไม่พบผู้ใช้");
  if (!newPassword) throw AppError.badRequest("ต้องระบุรหัสผ่านใหม่");

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      firstNameTh: true,
      firstNameEn: true,
    },
  });
  if (!user) throw AppError.notFound("ไม่พบผู้ใช้");

  const ok = await bcrypt.compare(
    String(currentPassword || ""),
    user.passwordHash || ""
  );
  if (!ok) throw AppError.badRequest("รหัสผ่านปัจจุบันไม่ถูกต้อง");

  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const hash = await bcrypt.hash(String(newPassword), rounds);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });

  try {
    const { subject, html, text } = renderPasswordChangedEmail({
      name: user.firstNameTh || user.firstNameEn || "",
    });
    await sendMail({ to: user.email, subject, html, text });
  } catch (err) {
    console.error("sendMail(change) failed:", err);
  }

  return { ok: true };
}

/* ---------------- Me ---------------- */
export async function meService({ prisma = defaultPrisma, userId }) {
  const u = await prisma.user.findFirst({
    where: { id: Number(userId), deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      avatarPath: true,
      role: { select: { name: true, labelTh: true, labelEn: true } },
      organization: {
        select: { id: true, code: true, nameTh: true, nameEn: true },
      },
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
        where: { endedAt: null, isActive: true },
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
  if (!u) throw AppError.notFound("ไม่พบข้อมูลผู้ใช้");
  return u;
}
