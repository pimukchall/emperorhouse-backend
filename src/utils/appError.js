export class AppError extends Error {
  constructor(code = "BAD_REQUEST", message = "คำขอไม่ถูกต้อง", status = 400, details = undefined) {
    super(message);
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }

  static badRequest(msg = "คำขอไม่ถูกต้อง", details) { return new AppError("BAD_REQUEST", msg, 400, details); }
  static unauthorized(msg = "กรุณาเข้าสู่ระบบ", details) { return new AppError("UNAUTHORIZED", msg, 401, details); }
  static forbidden(msg = "คุณไม่มีสิทธิ์ทำรายการนี้", details) { return new AppError("FORBIDDEN", msg, 403, details); }
  static notFound(msg = "ไม่พบข้อมูล", details) { return new AppError("NOT_FOUND", msg, 404, details); }
  static conflict(msg = "ข้อมูลซ้ำ", details) { return new AppError("CONFLICT", msg, 409, details); }
  static unprocessable(msg = "ข้อมูลไม่ผ่านการตรวจสอบ", details) { return new AppError("UNPROCESSABLE", msg, 422, details); }
  static internal(msg = "เกิดข้อผิดพลาดในระบบ", details) { return new AppError("INTERNAL_ERROR", msg, 500, details); }

  static fromPrisma(e) {
    switch (e?.code) {
      case "P2002": return AppError.conflict(`ข้อมูลซ้ำที่ฟิลด์: ${(e.meta?.target || []).join(", ") || "unique"}`);
      case "P2025": return AppError.notFound("ไม่พบข้อมูลที่ต้องการอัปเดต/ลบ");
      case "P2003": return AppError.badRequest("ความสัมพันธ์ข้อมูลไม่ถูกต้อง (foreign key)");
      case "P2020": return AppError.badRequest("รูปแบบค่าที่ส่งมาไม่ถูกต้อง");
      default: return AppError.internal("เกิดข้อผิดพลาดจากฐานข้อมูล", { code: e?.code });
    }
  }

  static fromMulter(e) {
    if (!e) return AppError.internal();
    if (e.code === "LIMIT_FILE_SIZE") return AppError.badRequest("ไฟล์ใหญ่เกินกำหนด");
    if (e.code === "LIMIT_UNEXPECTED_FILE") return AppError.badRequest("ฟิลด์ไฟล์ไม่ถูกต้อง");
    return AppError.badRequest(e.message || "อัปโหลดไฟล์ไม่สำเร็จ");
  }

  static fromUnknown(err) {
    if (!err) return AppError.internal();
    if (err instanceof AppError) return err;
    if (err?.code?.startsWith?.("P2")) return AppError.fromPrisma(err);
    if (err?.name === "MulterError") return AppError.fromMulter(err);
    // ถ้าเป็น error ที่ตั้ง status มาด้วยเอง
    if (typeof err?.status === "number" && err?.message) {
      return new AppError("INTERNAL_ERROR", err.message, err.status);
    }
    return AppError.internal("เกิดข้อผิดพลาดในระบบ", { message: err?.message });
  }
}
