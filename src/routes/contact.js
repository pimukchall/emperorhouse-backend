import { Router } from "express";
import nodemailer from "nodemailer";
import { prisma } from "../prisma.js";
import { requireRole } from '../middlewares/auth.js';

export const router = Router();

// ===== Anti-spam แบบเบา ๆ =====
const MIN_FILL_SECONDS = Number(process.env.CONTACT_MIN_FILL_SECONDS ?? 5);
const COOLDOWN_MS = Number(process.env.CONTACT_COOLDOWN_MS ?? 8000);
const ipLastHit = new Map(); // ip -> epoch(ms)

const isEmail = (v) => /.+@.+\..+/.test(String(v || ""));

// ===== Nodemailer Transporter =====
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: String(process.env.SMTP_SECURE ?? "false") === "true", // true = 465
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

// (แนะนำให้ตั้งค่าใน .env)
// MAIL_FROM: ที่อยู่ผู้ส่ง (เช่น "No-Reply <no-reply@your.co>")
// MAIL_TO:   กล่องที่ทีมคุณอยากรับแจ้ง (เช่น "support@your.co")

router.post("/", async (req, res) => {
  try {
    const {
      name = "",
      email = "",
      phone = "",
      subject = "",
      message = "",
      website = "",      // honeypot
      startedAtMs,       // optional
    } = req.body || {};

    // validate ขั้นต้น
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }
    if (String(website).trim() !== "") {
      return res.status(400).json({ ok: false, error: "Bot detected" });
    }

    // min-fill-time
    if (startedAtMs && Number.isFinite(Number(startedAtMs))) {
      const diffSec = (Date.now() - Number(startedAtMs)) / 1000;
      if (diffSec < MIN_FILL_SECONDS) {
        return res.status(400).json({ ok: false, error: "Please review and try again" });
      }
      if (Number(startedAtMs) - Date.now() > 2 * 60 * 1000) {
        return res.status(400).json({ ok: false, error: "Invalid timestamp" });
      }
    }

    // cooldown ต่อ IP
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "";
    const last = ipLastHit.get(ip) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      return res.status(429).json({ ok: false, error: "Too many requests, please wait." });
    }
    ipLastHit.set(ip, Date.now());

    const saved = await prisma.contactMessage.create({
      data: {
        name: String(name).slice(0, 120),
        email: String(email).slice(0, 160),
        phone: phone ? String(phone).slice(0, 32) : null,
        subject: String(subject).slice(0, 160),
        message: String(message),
      },
      select: { id: true, createdAt: true },
    });

    const MAIL_FROM = process.env.MAIL_FROM || `no-reply@localhost`;
    const MAIL_TO = process.env.MAIL_TO || process.env.SMTP_USER || "";

    const htmlBody = `
      <h2>New Contact Request</h2>
      <p><b>Name:</b> ${escapeHtml(name)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      ${phone ? `<p><b>Phone:</b> ${escapeHtml(phone)}</p>` : ""}
      <p><b>Subject:</b> ${escapeHtml(subject)}</p>
      <p><b>Message:</b><br>${nl2br(escapeHtml(message))}</p>
      <hr/>
      <p><small>Ticket ID: ${saved.id} • ${new Date(saved.createdAt).toLocaleString()}</small></p>
    `;
    const textBody =
      `New Contact Request\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      (phone ? `Phone: ${phone}\n` : ``) +
      `Subject: ${subject}\n\n` +
      `Message:\n${message}\n\n` +
      `Ticket ID: ${saved.id} • ${new Date(saved.createdAt).toISOString()}\n`;

    const sendToTeam = MAIL_TO
      ? transporter.sendMail({
          from: MAIL_FROM,
          to: MAIL_TO,
          subject: `[Contact] ${subject} (#${saved.id})`,
          text: textBody,
          html: htmlBody,
          replyTo: email, // กด Reply แล้วเด้งไปหาลูกค้า
        })
      : Promise.resolve();

    const sendToCustomer = MAIL_FROM
      ? transporter.sendMail({
          from: MAIL_FROM,
          to: email,
          subject: `เราได้รับข้อความของคุณแล้ว (#${saved.id})`,
          text:
            `สวัสดีคุณ ${name},\n\n` +
            `เราได้รับข้อความของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด\n\n` +
            `หัวข้อ: ${subject}\n` +
            `Ticket ID: ${saved.id}\n\n` +
            `ขอบคุณครับ/ค่ะ`,
          html:
            `<p>สวัสดีคุณ <b>${escapeHtml(name)}</b>,</p>` +
            `<p>เราได้รับข้อความของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด</p>` +
            `<p><b>หัวข้อ:</b> ${escapeHtml(subject)}<br/>` +
            `<b>Ticket ID:</b> ${saved.id}</p>` +
            `<p>ขอบคุณครับ/ค่ะ</p>`,
        })
      : Promise.resolve();

    const results = await Promise.allSettled([sendToTeam, sendToCustomer]);
    const mailed =
      results.every((r) => r.status === "fulfilled") ||
      results.some((r) => r.status === "fulfilled"); // ถ้าส่งได้อย่างน้อย 1 ฉบับก็นับ mailed=true

    return res.json({ ok: true, id: saved.id, mailed });
  } catch (err) {
    console.error("[POST /api/contact] error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// utils เล็ก ๆ สำหรับ body mail
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function nl2br(s) {
  return String(s || "").replace(/\n/g, "<br>");
}

// LIST: GET /api/contacts?q=&email=&dateFrom=&dateTo=&page=&limit=&sort=
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const {
      q, email, dateFrom, dateTo,
      page = '1', limit = '20', sort = 'desc'
    } = req.query;

    const where = {
      ...(email ? { email: { contains: String(email), mode: 'insensitive' } } : {}),
      ...(q ? {
        OR: [
          { name:    { contains: String(q), mode: 'insensitive' } },
          { subject: { contains: String(q), mode: 'insensitive' } },
          { message: { contains: String(q), mode: 'insensitive' } },
        ],
      } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
          ...(dateTo   ? { lte: new Date(String(dateTo))   } : {}),
        },
      } : {}),
    };

    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * take;

    const [total, items] = await Promise.all([
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: sort === 'asc' ? 'asc' : 'desc' },
        skip,
        take,
      }),
    ]);

    res.json({
      ok: true,
      data: items,
      meta: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// READ: GET /api/contacts/:id
router.get('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = await prisma.contactMessage.findUnique({ where: { id } });
    if (!data) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// DELETE: DELETE /api/contacts/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.contactMessage.delete({ where: { id } });
    res.json({ ok: true, deleted: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});
