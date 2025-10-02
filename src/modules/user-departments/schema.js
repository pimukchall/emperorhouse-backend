import { z } from "zod";

/** แปลงค่าที่พิมพ์มาเป็น boolean จริง */
export const Boolish = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(s)) return true;
    if (["false", "0", "no", "n", ""].includes(s)) return false;
  }
  return v;
}, z.boolean());

/** เลขจำนวนเต็ม (coerce) */
const IntId = z.coerce.number().int().positive();

/** DateTime string (ISO) หรือปล่อยว่าง */
const IsoDateOpt = z.string().datetime().optional();
const IsoDateNullOpt = z.string().datetime().nullable().optional();

/** Enum PositionLevel ตาม Prisma */
const PositionLevel = z.enum(["STAF", "SVR", "ASST", "MANAGER", "MD"]);

/* -------------------- Query/Params -------------------- */
export const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  q: z.string().trim().default(""),
  activeOnly: Boolish.optional().default(false),
  departmentId: IntId.optional(),
  userId: IntId.optional(),
});

export const ParamsUserId = z.object({
  userId: IntId,
});

export const ListByUserQuery = z.object({
  activeOnly: Boolish.optional().default(false),
});

export const ParamsId = z.object({
  id: IntId,
});

/* -------------------- Bodies -------------------- */
export const AssignBody = z.object({
  userId: IntId,
  departmentId: IntId,
  positionLevel: PositionLevel,
  positionName: z.string().trim().nullable().optional(),
  startedAt: IsoDateOpt,
  makePrimary: Boolish.optional().default(false),
});

export const EndOrRenameBody = z.object({
  endedAt: IsoDateNullOpt,                // ถ้าส่ง null/ไม่ส่ง = ไม่ end
  newPositionName: z.string().trim().nullable().optional(),
  reason: z.string().trim().optional(),
  effectiveDate: IsoDateOpt,              // วันที่มีผลของ log
});

export const ChangeLevelBody = z.object({
  toLevel: PositionLevel,
  newPositionName: z.string().trim().nullable().optional(),
  reason: z.string().trim().optional(),
  effectiveDate: IsoDateOpt,
});
