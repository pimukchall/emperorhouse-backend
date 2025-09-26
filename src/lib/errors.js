export class HttpError extends Error {
  constructor(status, message, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const err = (status, message, code) =>
  new HttpError(status, message, code);
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Factories
export const BadRequest = (m = "คำขอไม่ถูกต้อง") => err(400, m, "BAD_REQUEST");
export const Unauthorized = (m = "กรุณาเข้าสู่ระบบ") =>
  err(401, m, "UNAUTHORIZED");
export const Forbidden = (m = "คุณไม่มีสิทธิ์ทำรายการนี้") =>
  err(403, m, "FORBIDDEN");
export const NotFound = (m = "ไม่พบข้อมูล") => err(404, m, "NOT_FOUND");
export const Conflict = (m = "ข้อมูลซ้ำ") => err(409, m, "CONFLICT");
export const Internal = (m = "เกิดข้อผิดพลาดในระบบ") =>
  err(500, m, "INTERNAL_ERROR");

// แปลง error เป็น payload สำหรับส่งให้ผู้ใช้ (ฝั่ง middleware error จะเรียกใช้)
export function toUserErrorPayload(e) {
  const status = e.status || 500;
  const isServer = status >= 500;
  return {
    status,
    body: {
      ok: false,
      error: {
        code: e.code || (isServer ? "INTERNAL_ERROR" : "BAD_REQUEST"),
        message: isServer
          ? "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง"
          : e.message || "เกิดข้อผิดพลาด",
      },
    },
  };
}
