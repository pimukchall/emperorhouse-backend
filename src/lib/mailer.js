import nodemailer from "nodemailer";

let _tx = null;

function bool(v, def = false) {
  if (v === undefined) return def;
  return v === true || v === "true" || v === "1";
}

async function createTransporter() {
  // ใช้ SMTP จริงถ้ามี ENV
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: bool(process.env.SMTP_SECURE, false), // true = 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
    });
  }

  // Dev: สร้างบัญชี Ethereal อัตโนมัติ
  const test = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: test.user, pass: test.pass },
  });
}

export async function getTransporter() {
  if (_tx) return _tx;
  _tx = await createTransporter();
  return _tx;
}

export async function sendMail({ to, subject, html, text }) {
  const tx = await getTransporter();
  const from =
    process.env.MAIL_FROM ||
    `"${process.env.APP_NAME || "EMP One"}" <no-reply@example.com>`;
  const info = await tx.sendMail({ from, to, subject, html, text });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.log(`📧 [Ethereal preview] ${preview}`);
  }
  return info;
}

// ---------- เทมเพลตอีเมล ----------
const APP_NAME = process.env.APP_NAME || "EMP One";
const FRONTEND = process.env.FRONTEND_BASE_URL || "http://localhost:3000";

export function makeResetLink(token) {
  return `${FRONTEND}/reset-password?token=${encodeURIComponent(token)}`;
}

export function renderForgotPasswordEmail({ name = "", resetUrl }) {
  return {
    subject: `[${APP_NAME}] ลิงก์สำหรับรีเซ็ตรหัสผ่าน`,
    html: `
      <p>สวัสดี ${name || "ผู้ใช้งาน"},</p>
      <p>คลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ (ลิงก์หมดอายุภายใน 30 นาที):</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>หากคุณไม่ได้ร้องขอ สามารถเพิกเฉยต่ออีเมลฉบับนี้ได้</p>
    `,
    text: `สวัสดี ${name || "ผู้ใช้งาน"},
คลิกลิงก์เพื่อรีเซ็ตรหัสผ่าน (หมดอายุ 30 นาที):
${resetUrl}
หากคุณไม่ได้ร้องขอ สามารถเพิกเฉยต่ออีเมลนี้ได้`,
  };
}

export function renderPasswordChangedEmail({ name = "" }) {
  return {
    subject: `[${APP_NAME}] ยืนยันการเปลี่ยนรหัสผ่าน`,
    html: `
      <p>สวัสดี ${name || "ผู้ใช้งาน"},</p>
      <p>รหัสผ่านของบัญชีคุณถูกเปลี่ยนเรียบร้อยแล้ว หากไม่ใช่คุณ โปรดติดต่อผู้ดูแลระบบทันที</p>
    `,
    text: `สวัสดี ${name || "ผู้ใช้งาน"},
รหัสผ่านของบัญชีคุณถูกเปลี่ยนเรียบร้อยแล้ว หากไม่ใช่คุณ โปรดติดต่อผู้ดูแลระบบทันที`,
  };
}

export function renderAdminResetEmail({ name = "" }) {
  return {
    subject: `[${APP_NAME}] ผู้ดูแลระบบได้รีเซ็ตรหัสผ่านให้คุณ`,
    html: `
      <p>สวัสดี ${name || "ผู้ใช้งาน"},</p>
      <p>ผู้ดูแลระบบได้ทำการรีเซ็ตรหัสผ่านให้คุณเรียบร้อยแล้ว หากไม่ได้ร้องขอ โปรดแจ้งผู้ดูแลทันที</p>
    `,
    text: `สวัสดี ${name || "ผู้ใช้งาน"},
ผู้ดูแลระบบได้ทำการรีเซ็ตรหัสผ่านให้คุณเรียบร้อยแล้ว หากไม่ได้ร้องขอ โปรดแจ้งผู้ดูแลทันที`,
  };
}
