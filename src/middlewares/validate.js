import { ZodError } from "zod";

/**
 * validate(schema, target?)
 *  - target: "body" (default) | "query" | "params" | "headers"
 *  - ปลอดภัยกับ Express 5: จะไม่ assign ทับ req.query ตรงๆ
 *  - ถ้าตรวจไม่ผ่าน -> 400 พร้อม issues ที่อ่านง่าย
 */
export function validate(schema, target = "body") {
  return (req, res, next) => {
    try {
      const src = pickSource(req, target);

      // ใช้ safeParse เพื่อกัน throw
      const result = schema.safeParse(src);
      if (!result.success) {
        return sendValidationError(res, result.error);
      }

      // เขียนค่าที่ parse แล้วกลับเข้า req
      if (target === "query") {
        // Express 5: req.query เป็น getter -> แก้ค่า "ภายใน" แทนการ reassign
        // ล้างของเดิมแล้วเติมของใหม่
        for (const k of Object.keys(src)) delete src[k];
        Object.assign(src, result.data);
      } else if (target === "headers") {
        // อย่าทับ headers ดิบ—เก็บไว้ที่ req.validated.headers
        req.validated = req.validated || {};
        req.validated.headers = result.data;
      } else if (target === "params") {
        req.params = result.data; // ปลอดภัย
      } else {
        req.body = result.data; // body: ปลอดภัย
      }

      return next();
    } catch (err) {
      // กัน edge cases จาก schema แปลกๆ
      if (err instanceof ZodError) {
        return sendValidationError(res, err);
      }
      return next(err);
    }
  };
}

function pickSource(req, target) {
  switch (target) {
    case "query":
      return req.query || {};
    case "params":
      return req.params || {};
    case "headers":
      // แปลง header key เป็น lower-case แล้วคัดลอก เพื่อกัน mutation ตรงๆ
      return Object.fromEntries(
        Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
      );
    case "body":
    default:
      return req.body || {};
  }
}

function sendValidationError(res, zodError) {
  const issues =
    zodError?.issues?.map((i) => ({
      path: Array.isArray(i.path) ? i.path.join(".") : String(i.path || ""),
      message: i.message,
      code: i.code,
      expected: i.expected,
      received: i.received,
    })) || [];

  return res.status(400).json({
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      issues,
    },
  });
}
