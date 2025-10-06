import pino from "pino";
import pinoHttp from "pino-http";

const isProd = process.env.NODE_ENV === "production";
const level  = process.env.LOG_LEVEL || (isProd ? "info" : "debug");

export const logger = pino(
  isProd
    ? { level, redact: ["req.headers.authorization", "res.headers.set-cookie", "req.body.password", "req.body.token", "req.query.token"] }
    : {
        level,
        transport: { target: "pino-pretty", options: { colorize: true } },
      }
);

export const httpLogger = pinoHttp({
  logger,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `ERR ${req.method} ${req.url} -> ${res.statusCode} : ${err?.message || "-"}`,
});