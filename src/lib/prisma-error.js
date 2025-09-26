export function mapPrismaError(e) {
  if (e?.code === "P2002") {
    const field = e.meta?.target?.join?.(",") || "unique";
    const err = new Error(`ข้อมูลซ้ำที่ฟิลด์: ${field}`);
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    return err;
  }
  if (e?.code === "P2025") {
    const err = new Error("ไม่พบข้อมูลที่ต้องการอัปเดต/ลบ");
    err.code = "NOT_FOUND";
    err.status = 404;
    return err;
  }
  if (e?.code === "P2003") {
    const err = new Error("ความสัมพันธ์ข้อมูลไม่ถูกต้อง (foreign key)");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    return err;
  }
  if (e?.code === "P2020") {
    const err = new Error("รูปแบบค่าที่ส่งมาไม่ถูกต้อง");
    err.code = "VALIDATION_ERROR";
    err.status = 400;
    return err;
  }
  return e;
}
