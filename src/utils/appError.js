export class AppError extends Error {
  constructor(
    code = "BAD_REQUEST",
    message = "คำขอไม่ถูกต้อง",
    status = 400,
    details = undefined
  ) {
    super(message);
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }

  // ----- factories -----
  static badRequest(msg = "คำขอไม่ถูกต้อง", details) {
    return new AppError("BAD_REQUEST", msg, 400, details);
  }
  static unauthorized(msg = "กรุณาเข้าสู่ระบบ", details) {
    return new AppError("UNAUTHORIZED", msg, 401, details);
  }
  static forbidden(msg = "คุณไม่มีสิทธิ์ทำรายการนี้", details) {
    return new AppError("FORBIDDEN", msg, 403, details);
  }
  static notFound(msg = "ไม่พบข้อมูล", details) {
    return new AppError("NOT_FOUND", msg, 404, details);
  }
  static conflict(msg = "ข้อมูลซ้ำ", details) {
    return new AppError("CONFLICT", msg, 409, details);
  }
  static internal(msg = "เกิดข้อผิดพลาดในระบบ", details) {
    return new AppError("INTERNAL_ERROR", msg, 500, details);
  }

  // ----- mappers -----
  static fromPrisma(e) {
    // PrismaClientKnownRequestError
    switch (e?.code) {
      case "P2002":
        return AppError.conflict(
          `ข้อมูลซ้ำที่ฟิลด์: ${(e.meta?.target || []).join(", ") || "unique"}`
        );
      case "P2025":
        return AppError.notFound("ไม่พบข้อมูลที่ต้องการอัปเดต/ลบ");
      case "P2003":
        return AppError.badRequest(
          "ความสัมพันธ์ข้อมูลไม่ถูกต้อง (foreign key)"
        );
      case "P2020":
        return AppError.badRequest("รูปแบบค่าที่ส่งมาไม่ถูกต้อง");
      default:
        return AppError.internal("เกิดข้อผิดพลาดจากฐานข้อมูล", {
          code: e?.code,
        });
    }
  }

  static fromZod(zerr, msg = "ข้อมูลที่ส่งมาไม่ถูกต้อง") {
    const issues = Array.isArray(zerr?.errors)
      ? zerr.errors.map((i) => ({ path: i.path.join("."), message: i.message }))
      : undefined;
    return AppError.badRequest(msg, issues);
  }

  static fromUnknown(err) {
    if (!err) return AppError.internal();
    if (err instanceof AppError) return err;
    if (err?.code && err?.status)
      return new AppError(err.code, err.message, err.status, err.details);
    return AppError.internal("เกิดข้อผิดพลาดในระบบ", { message: err?.message });
  }
}
