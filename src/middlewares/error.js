export function notFound(_req, res) {
  res.status(404).json({
    ok: false,
    error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลหรือเส้นทางที่คุณเรียก" },
  });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const isServer = status >= 500;

  if (isServer) console.error(err);

  const map = {
    UNAUTHORIZED: "คุณไม่ได้รับสิทธิ์เข้าถึง",
    FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
    VALIDATION_ERROR: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
  };

  res.status(status).json({
    ok: false,
    error: {
      code: err.code || (isServer ? "INTERNAL_ERROR" : "BAD_REQUEST"),
      message: isServer
        ? "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่ภายหลัง"
        : map[err.code] || err.message || "เกิดข้อผิดพลาด",
    },
  });
}
