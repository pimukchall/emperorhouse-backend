import nodemailer from "nodemailer";
import { env } from "#config/env.js";

let _tx = null;

async function createTransporter() {
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      pool: true,
    });
  }
  // Dev: Ethereal
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
  const info = await tx.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log(`📧 [Ethereal preview] ${preview}`);
  return info;
}

// ---------- templates ----------
const APP_NAME = "EMP One";
const FRONTEND = env.FRONTEND_BASE_URL;

export function makeResetLink(token) {
  const u = new URL("/reset-password", FRONTEND);
  u.searchParams.set("token", token);
  return u.toString();
}

export function renderForgotPasswordEmail({ name = "", resetUrl }) {
  return {
    subject: `[${APP_NAME}] ลิงก์สำหรับรีเซ็ตรหัสผ่าน`,
    html: `<p>สวัสดี ${name || "ผู้ใช้งาน"},</p>
<p>คลิกเพื่อรีเซ็ตรหัสผ่าน (หมดอายุ 30 นาที): <a href="${resetUrl}">${resetUrl}</a></p>`,
    text: `สวัสดี ${name || "ผู้ใช้งาน"},\nลิงก์รีเซ็ต (30 นาที): ${resetUrl}`,
  };
}

export function renderPasswordChangedEmail({ name = "" }) {
  return {
    subject: `[${APP_NAME}] ยืนยันการเปลี่ยนรหัสผ่าน`,
    html: `<p>สวัสดี ${name || "ผู้ใช้งาน"},</p><p>รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว</p>`,
    text: `สวัสดี ${name || "ผู้ใช้งาน"}, รหัสผ่านของคุณถูกเปลี่ยนแล้ว`,
  };
}

export function renderAdminResetEmail({ name = "" }) {
  return {
    subject: `[${APP_NAME}] ผู้ดูแลระบบได้รีเซ็ตรหัสผ่านให้คุณ`,
    html: `<p>สวัสดี ${name || "ผู้ใช้งาน"},</p><p>ผู้ดูแลระบบได้รีเซ็ตรหัสผ่านให้คุณเรียบร้อยแล้ว</p>`,
    text: `สวัสดี ${name || "ผู้ใช้งาน"}, ผู้ดูแลระบบได้รีเซ็ตรหัสผ่านให้คุณแล้ว`,
  };
}
