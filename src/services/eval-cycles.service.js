import { prisma } from "../prisma.js";

/** Helpers */
function parseDateMaybe(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) {
    const e = new Error("วันที่ไม่ถูกต้อง");
    e.status = 400;
    throw e;
  }
  return d;
}
function validateDatesOrThrow({ openAt, closeAt, isActive }) {
  const now = new Date();

  // ต้องมีครบและเรียงลำดับถูกต้อง
  if (!openAt || !closeAt) {
    const e = new Error("ไม่พบวันที่เปิด-ปิดรับการประเมิน");
    e.status = 400;
    throw e;
  }
  if (openAt >= closeAt) {
    const e = new Error("ไม่ถูกต้อง: วันที่เปิดต้องมาก่อนวันที่ปิด");
    e.status = 400;
    throw e;
  }

  // ห้ามย้อนหลัง
  if (openAt < now || closeAt < now) {
    const e = new Error("ไม่ถูกต้อง: วันที่เปิด-ปิด ต้องไม่ใช่วันในอดีต");
    e.status = 400;
    throw e;
  }

  // กันกรณีจะเปิดใช้งานรอบที่หมดอายุ (ปิดไปแล้ว) — เผื่ออนาคตปรับนโยบาย
  if (isActive === true && closeAt < now) {
    const e = new Error("ไม่สามารถเปิดใช้งานรอบที่หมดอายุแล้วได้");
    e.status = 400;
    throw e;
  }
}

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
    const e = new Error("ไม่พบรอบการประเมิน");
    e.status = 404;
    throw e;
  }
  return row;
}

export async function createCycleService(data) {
  const { code, year, stage } = data || {};
  const openAt = parseDateMaybe(data?.openAt);
  const closeAt = parseDateMaybe(data?.closeAt);
  const isActive = data?.isActive ?? true;
  const isMandatory = data?.isMandatory ?? true;

  if (!code || !year || !stage) {
    const e = new Error("ข้อมูลไม่ครบถ้วน");
    e.status = 400;
    throw e;
  }

  validateDatesOrThrow({ openAt, closeAt, isActive });

  return prisma.evalCycle.create({
    data: {
      code: String(code).trim(),
      year: Number(year),
      stage: String(stage).toUpperCase(),
      openAt,
      closeAt,
      isActive: Boolean(isActive),
      isMandatory: Boolean(isMandatory),
    },
  });
}

export async function updateCycleService(id, data) {
  // โหลดค่าปัจจุบันไว้ประกอบการ validate กรณีอัปเดตทีละ field
  const current = await prisma.evalCycle.findUnique({ where: { id: Number(id) } });
  if (!current) {
    const err = new Error("ไม่พบรอบการประเมิน");
    err.status = 404;
    throw err;
  }

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
  if (data.openAt !== undefined) payload.openAt = parseDateMaybe(data.openAt);
  if (data.closeAt !== undefined) payload.closeAt = parseDateMaybe(data.closeAt);
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  if (data.isMandatory !== undefined) payload.isMandatory = Boolean(data.isMandatory);

  // ค่าที่จะกลายเป็นค่าจริงหลังอัปเดต (ใช้ตรวจความถูกต้อง)
  const next = {
    openAt: payload.openAt ?? current.openAt,
    closeAt: payload.closeAt ?? current.closeAt,
    isActive: payload.isActive ?? current.isActive,
  };
  validateDatesOrThrow(next);

  try {
    return await prisma.evalCycle.update({ where: { id: Number(id) }, data: payload });
  } catch (e) {
    if (String(e?.message || "").includes("P2025")) {
      const err = new Error("ไม่พบรอบการประเมิน");
      err.status = 404;
      throw err;
    }
    throw e;
  }
}

export async function deleteCycleService(id) {
  const cycleId = Number(id);
  // ห้ามลบถ้ามีฟอร์มใช้งานแล้ว
  const usedCount = await prisma.evaluation.count({ where: { cycleId } });
  if (usedCount > 0) {
    const e = new Error("ไม่สามารถลบรอบการประเมินได้ เนื่องจากมีการใช้งานอยู่");
    e.status = 409;
    throw e;
  }

  try {
    await prisma.evalCycle.delete({ where: { id: cycleId } });
    return { ok: true };
  } catch (e) {
    if (String(e?.message || "").includes("P2025")) {
      const err = new Error("ไม่พบรอบการประเมิน");
      err.status = 404;
      throw err;
    }
    throw e;
  }
}
