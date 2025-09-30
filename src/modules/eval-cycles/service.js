import { prisma as defaultPrisma } from "#lib/prisma.js";
import { AppError } from "#utils/appError.js";
import { applyPrismaPagingSort } from "#utils/pagination.js";

/* ---------------- helpers ---------------- */
function validateDatesOrThrow({ openAt, closeAt, isActive }) {
  const now = new Date();
  if (!openAt || !closeAt) throw AppError.badRequest("ไม่พบวันที่เปิด-ปิดรับการประเมิน");
  if (openAt >= closeAt) throw AppError.badRequest("ไม่ถูกต้อง: วันที่เปิดต้องมาก่อนวันที่ปิด");
  if (openAt < now || closeAt < now) throw AppError.badRequest("ไม่ถูกต้อง: วันที่เปิด-ปิด ต้องไม่ใช่วันในอดีต");
  if (isActive === true && closeAt < now) throw AppError.badRequest("ไม่สามารถเปิดใช้งานรอบที่หมดอายุแล้วได้");
}

/* ---------------- services ---------------- */
export async function listCyclesService(
  { page = 1, limit = 50, sortBy = "year", sort = "desc" } = {},
  { prisma = defaultPrisma } = {}
) {
  const args = applyPrismaPagingSort(
    { where: {}, select: { id: true, code: true, year: true, stage: true, openAt: true, closeAt: true, isActive: true, isMandatory: true, createdAt: true } },
    { page, limit, sortBy, sort },
    {
      sortMap: {
        id: "id",
        code: "code",
        year: "year",
        stage: "stage",
        openAt: "openAt",
        closeAt: "closeAt",
        isActive: "isActive",
        createdAt: "createdAt",
        default: "year",
      },
    }
  );

  const [rows, total] = await Promise.all([
    prisma.evalCycle.findMany(args),
    prisma.evalCycle.count(),
  ]);

  const ob = args.orderBy || {};
  return {
    rows,
    total,
    page: args.page,
    limit: args.take,
    sortBy: Object.keys(ob)[0],
    sort: Object.values(ob)[0],
  };
}

export async function getCycleService({ id }, { prisma = defaultPrisma } = {}) {
  const cid = Number(id);
  if (!Number.isFinite(cid)) throw AppError.badRequest("id ไม่ถูกต้อง");

  const row = await prisma.evalCycle.findUnique({
    where: { id: cid },
    select: { id: true, code: true, year: true, stage: true, openAt: true, closeAt: true, isActive: true, isMandatory: true, createdAt: true },
  });
  if (!row) throw AppError.notFound("ไม่พบรอบการประเมิน");
  return row;
}

export async function createCycleService({ data }, { prisma = defaultPrisma } = {}) {
  const { code, year, stage, openAt, closeAt, isActive = true, isMandatory = true } = data || {};
  if (!code || !year || !stage) throw AppError.badRequest("ข้อมูลไม่ครบถ้วน");

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
    select: { id: true, code: true, year: true, stage: true, openAt: true, closeAt: true, isActive: true, isMandatory: true, createdAt: true },
  });
}

export async function updateCycleService({ id, data }, { prisma = defaultPrisma } = {}) {
  const cid = Number(id);
  if (!Number.isFinite(cid)) throw AppError.badRequest("id ไม่ถูกต้อง");

  const current = await prisma.evalCycle.findUnique({ where: { id: cid } });
  if (!current) throw AppError.notFound("ไม่พบรอบการประเมิน");

  const payload = {};
  if (data.code !== undefined) {
    const code = String(data.code).trim();
    if (!code) throw AppError.badRequest("รหัสรอบการประเมินไม่ถูกต้อง");
    payload.code = code;
  }
  if (data.year !== undefined) payload.year = Number(data.year);
  if (data.stage !== undefined) payload.stage = String(data.stage).toUpperCase();
  if (data.openAt !== undefined) payload.openAt = data.openAt;
  if (data.closeAt !== undefined) payload.closeAt = data.closeAt;
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  if (data.isMandatory !== undefined) payload.isMandatory = Boolean(data.isMandatory);

  const next = {
    openAt: payload.openAt ?? current.openAt,
    closeAt: payload.closeAt ?? current.closeAt,
    isActive: payload.isActive ?? current.isActive,
  };
  validateDatesOrThrow(next);

  return prisma.evalCycle.update({
    where: { id: cid },
    data: payload,
    select: { id: true, code: true, year: true, stage: true, openAt: true, closeAt: true, isActive: true, isMandatory: true, createdAt: true },
  });
}

export async function deleteCycleService({ id }, { prisma = defaultPrisma } = {}) {
  const cid = Number(id);
  if (!Number.isFinite(cid)) throw AppError.badRequest("id ไม่ถูกต้อง");

  const usedCount = await prisma.evaluation.count({ where: { cycleId: cid } });
  if (usedCount > 0) throw AppError.conflict("ไม่สามารถลบรอบการประเมินได้ เนื่องจากมีการใช้งานอยู่");

  await prisma.evalCycle.delete({ where: { id: cid } });
  return { ok: true };
}
