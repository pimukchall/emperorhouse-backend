import { ZodError } from "zod";

/**
 * validate(schema, source?)
 * source: "body" | "query" | "params" | "headers" (default: "body")
 */
export const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    try {
      const data = req[source] ?? {};
      const parsed = schema.parse(data);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
            issues: err.errors.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
        });
      }
      next(err);
    }
  };
