import { prisma } from "../prisma.js";
import { parsePaging, ilikeContains, pickSort, toInt } from "../services/query.util.js";
import { submitContactService } from "../services/contacts.service.js";

// POST /api/contacts
export async function createContactController(req, res) {
  try {
    const result = await submitContactService({ prisma, body: req.body || {} });
    return res.status(201).json({ ok: true, ...result });
  } catch (e) {
    return res.status(400).json({ ok: false, error: String(e?.message || e) });
  }
}

// GET /api/contacts
export async function listContactsController(req, res) {
  const { page, limit, skip, sort, sortBy } = parsePaging(req, { defaultLimit: 20, maxLimit: 200 });
  const q = req.query.q ? String(req.query.q) : "";
  const email = req.query.email ? String(req.query.email) : "";
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

  const where = {
    ...(q
      ? { OR: [{ name: ilikeContains(q) }, { subject: ilikeContains(q) }, { message: ilikeContains(q) }] }
      : {}),
    ...(email ? { email: ilikeContains(email) } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: new Date(new Date(dateTo).getTime() + 24 * 3600 * 1000 - 1) } : {}) } }
      : {}),
  };

  const sortField = pickSort(sortBy, ["createdAt", "id", "email", "subject"]);
  const [rows, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { [sortField]: sort },
      skip,
      take: limit,
      select: { id: true, name: true, email: true, subject: true, createdAt: true },
    }),
    prisma.contactMessage.count({ where }),
  ]);

  res.json({ ok: true, data: rows, meta: { page, pages: Math.max(1, Math.ceil(total / limit)), total } });
}

// GET /api/contacts/:id
export async function getContactController(req, res) {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });

  const c = await prisma.contactMessage.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ ok: false, error: "CONTACT_NOT_FOUND" });
  res.json({ ok: true, data: c });
}

// DELETE /api/contacts/:id
export async function deleteContactController(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });
    await prisma.contactMessage.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/P2025/.test(msg)) return res.status(404).json({ ok: false, error: "CONTACT_NOT_FOUND" });
    res.status(400).json({ ok: false, error: msg });
  }
}
