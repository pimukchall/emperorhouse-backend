import { sendMail } from "../lib/mailer.js";

// ---------- CREATE ----------
export async function submitContactService({ prisma, body }) {
  const { name, email, phone, subject, message } = body || {};
  if (!name || !email || !subject || !message) throw new Error("missing fields");

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

  const htmlToTeam =
    `<h2>New Contact Request</h2>` +
    `<p><b>Name:</b> ${esc(name)}</p>` +
    `<p><b>Email:</b> ${esc(email)}</p>` +
    (phone ? `<p><b>Phone:</b> ${esc(phone)}</p>` : "") +
    `<p><b>Subject:</b> ${esc(subject)}</p>` +
    `<p><b>Message:</b><br>${nl2br(esc(message))}</p>` +
    `<hr/><p><small>Ticket ID: #${saved.id} • ${new Date(saved.createdAt).toLocaleString()}</small></p>`;

  const textToTeam =
    `New Contact Request\n` +
    `Name: ${name}\nEmail: ${email}\n` +
    (phone ? `Phone: ${phone}\n` : ``) +
    `Subject: ${subject}\n\nMessage:\n${message}\n\n` +
    `Ticket ID: #${saved.id} • ${new Date(saved.createdAt).toISOString()}\n`;

  const tasks = [];
  const MAIL_TO = process.env.MAIL_TO || process.env.SMTP_USER || "";

  if (MAIL_TO) {
    tasks.push(
      sendMail({
        to: MAIL_TO,
        subject: `[Contact] ${subject} (#${saved.id})`,
        html: htmlToTeam,
        text: textToTeam,
      })
    );
  }

  tasks.push(
    sendMail({
      to: email,
      subject: `เราได้รับข้อความของคุณแล้ว (#${saved.id})`,
      html:
        `<p>สวัสดีคุณ <b>${esc(name)}</b>,</p>` +
        `<p>เราได้รับข้อความของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด</p>` +
        `<p><b>หัวข้อ:</b> ${esc(subject)}<br/><b>Ticket ID:</b> #${saved.id}</p>` +
        `<p>ขอบคุณครับ/ค่ะ</p>`,
      text:
        `สวัสดีคุณ ${name},\n\n` +
        `เราได้รับข้อความของคุณเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด\n\n` +
        `หัวข้อ: ${subject}\nTicket ID: #${saved.id}\n\nขอบคุณครับ/ค่ะ`,
    })
  );

  const results = await Promise.allSettled(tasks);
  const mailed = results.some((r) => r.status === "fulfilled");

  return { id: saved.id, createdAt: saved.createdAt, mailed };
}

// ---------- LIST ----------
export async function listContactsService({ prisma, q, email, page, limit, sort }) {
  const where = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { subject: { contains: q } },
              { message: { contains: q } },
            ],
          }
        : {},
      email ? { email: { equals: email } } : {},
    ],
  };

  const orderBy = { createdAt: sort === "asc" ? "asc" : "desc" };
  const skip = (page - 1) * limit;
  const take = limit;

  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        createdAt: true,
      },
    }),
    prisma.contactMessage.count({ where }),
  ]);

  return { items, total, page, limit };
}

// utils
function esc(s) {
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
