import { prisma as defaultPrisma } from "#lib/prisma.js";
import { sendMail } from "#lib/mailer.js";
import { env } from "#config/env.js";
import { AppError } from "#utils/appError.js";
import { ilikeContains, toInt, normalizeSort } from "#utils/query.util.js";
import { applyPrismaPagingSort, buildListResponse } from "#utils/pagination.js";

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function nl2br(s = "") { return String(s).replace(/\n/g, "<br>"); }

// CREATE (คงเดิม)
export async function submitContactService({ prisma = defaultPrisma, body }) {
  const { name, email, phone, subject, message } = body || {};
  const nm = String(name ?? "").trim();
  const em = String(email ?? "").trim().toLowerCase();
  const sj = String(subject ?? "").trim();
  const msg = String(message ?? "").trim();
  if (!nm || !em || !sj || !msg) throw AppError.badRequest("ข้อมูลไม่ครบถ้วน");

  const saved = await prisma.contactMessage.create({
    data: {
      name: nm.slice(0, 120),
      email: em.slice(0, 160),
      phone: phone ? String(phone).slice(0, 32) : null,
      subject: sj.slice(0, 160),
      message: msg,
    },
    select: { id: true, createdAt: true },
  });

  const htmlToTeam =
    `<p><b>Name:</b> ${esc(nm)}</p>` +
    `<p><b>Email:</b> ${esc(em)}</p>` +
    (phone ? `<p><b>Phone:</b> ${esc(String(phone))}</p>` : "") +
    `<p><b>Subject:</b> ${esc(sj)}</p>` +
    `<p><b>Message:</b><br>${nl2br(esc(msg))}</p>` +
    `<hr/><p><small>Ticket ID: #${saved.id} • ${new Date(saved.createdAt).toLocaleString()}</small></p>`;

  const textToTeam =
    `New Contact Request\n` +
    `Name: ${nm}\nEmail: ${em}\n` +
    (phone ? `Phone: ${phone}\n` : ``) +
    `Subject: ${sj}\n\nMessage:\n${msg}\n\n` +
    `Ticket ID: #${saved.id} • ${new Date(saved.createdAt).toISOString()}\n`;

  const tasks = [];
  const MAIL_TO = (env.MAIL_TO || env.SMTP_USER || "").trim();
  if (MAIL_TO) {
    tasks.push(sendMail({ to: MAIL_TO, subject: `[Contact] ${sj} (#${saved.id})`, html: htmlToTeam, text: textToTeam }));
  }
  tasks.push(
    sendMail({
      to: em,
      subject: `เราได้รับข้อความของคุณแล้ว (#${saved.id})`,
      html:
        `<p>สวัสดีคุณ <b>${esc(nm)}</b>,</p>` +
        `<p>เราได้รับข้อความของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด</p>` +
        `<p><b>หัวข้อ:</b> ${esc(sj)}<br/><b>Ticket ID:</b> #${saved.id}</p>` +
        `<p>ขอบคุณครับ/ค่ะ</p>`,
      text:
        `สวัสดีคุณ ${nm},\n\nเราได้รับข้อความของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด\n\n` +
        `หัวข้อ: ${sj}\nTicket ID: #${saved.id}\n\nขอบคุณครับ/ค่ะ`,
    })
  );
  const results = await Promise.allSettled(tasks);
  const mailed = results.some((r) => r.status === "fulfilled");
  return { id: saved.id, createdAt: saved.createdAt, mailed };
}

// LIST (ปรับใหม่)
export async function listContactsService({
  prisma = defaultPrisma,
  q = "",
  email,
  page = 1,
  limit = 20,
  sortBy = "createdAt",
  sort = "desc",
} = {}) {
  const filters = [];
  if (q) {
    filters.push({
      OR: [
        { name: ilikeContains(q) },
        { email: ilikeContains(q) },
        { subject: ilikeContains(q) },
        { message: ilikeContains(q) },
      ],
    });
  }
  if (email) filters.push({ email: String(email).toLowerCase() });

  const where = filters.length ? { AND: filters } : {};

  const args = applyPrismaPagingSort(
    { where, select: { id: true, name: true, email: true, phone: true, subject: true, message: true, createdAt: true } },
    { page: toInt(page, 1), limit: toInt(limit, 20), sortBy, sort: normalizeSort(sort, "desc") },
    { sortMap: { createdAt: "createdAt", subject: "subject", email: "email", default: "createdAt" } }
  );

  const [rows, total] = await Promise.all([
    prisma.contactMessage.findMany(args),
    prisma.contactMessage.count({ where }),
  ]);
  return buildListResponse({ rows, total, page, limit, sortBy: Object.keys(args.orderBy || {})[0], sort: Object.values(args.orderBy || {})[0] });
}