import { prisma } from "../prisma.js";

export async function listCyclesService({ page = 1, limit = 50, sortBy = "year", sort = "desc" } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (p - 1) * l;

  const allowSort = new Set(["id", "code", "year", "stage", "openAt", "closeAt", "isActive", "createdAt"]);
  const sField = allowSort.has(String(sortBy)) ? String(sortBy) : "year";
  const sOrder = String(sort).toLowerCase() === "asc" ? "asc" : "desc";

  const [items, total] = await Promise.all([
    prisma.evalCycle.findMany({ orderBy: { [sField]: sOrder }, skip, take: l }),
    prisma.evalCycle.count(),
  ]);
  return { items, meta: { page: p, pages: Math.max(1, Math.ceil(total / l)), total } };
}

export async function getCycleService(id) {
  const row = await prisma.evalCycle.findUnique({ where: { id: Number(id) } });
  if (!row) {
    const e = new Error("CYCLE_NOT_FOUND");
    e.status = 404;
    throw e;
  }
  return row;
}

export async function createCycleService(data) {
  const { code, year, stage, openAt, closeAt, isActive = true, isMandatory = true } = data || {};
  if (!code || !year || !stage || !openAt || !closeAt) {
    const e = new Error("MISSING_FIELDS");
    e.status = 400;
    throw e;
  }
  return prisma.evalCycle.create({
    data: {
      code,
      year: Number(year),
      stage: String(stage).toUpperCase(),
      openAt: new Date(openAt),
      closeAt: new Date(closeAt),
      isActive: Boolean(isActive),
      isMandatory: Boolean(isMandatory),
    },
  });
}

export async function updateCycleService(id, data) {
  const payload = {};
  if (data.code !== undefined) {
    const code = String(data.code).trim();
    if (!code) {
      const e = new Error("รหัสรอบการประเมินไม่ถูกต้อง");
      e.status = 400;
      throw e;
    }
    payload.code = code;
  }
  if (data.year !== undefined) payload.year = Number(data.year);
  if (data.stage !== undefined) payload.stage = String(data.stage).toUpperCase();
  if (data.openAt !== undefined) payload.openAt = new Date(data.openAt);
  if (data.closeAt !== undefined) payload.closeAt = new Date(data.closeAt);
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  if (data.isMandatory !== undefined) payload.isMandatory = Boolean(data.isMandatory);

  try {
    return await prisma.evalCycle.update({ where: { id: Number(id) }, data: payload });
  } catch (e) {
    if (String(e?.message || "").includes("P2025")) {
      const err = new Error("CYCLE_NOT_FOUND");
      err.status = 404;
      throw err;
    }
    throw e;
  }
}

export async function deleteCycleService(id) {
  try {
    await prisma.evalCycle.delete({ where: { id: Number(id) } });
    return { ok: true };
  } catch (e) {
    if (String(e?.message || "").includes("P2025")) {
      const err = new Error("CYCLE_NOT_FOUND");
      err.status = 404;
      throw err;
    }
    throw e;
  }
}
