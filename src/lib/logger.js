import pino from "pino";
import pinoHttp from "pino-http";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino(
  isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
);

export const httpLogger = pinoHttp({ logger });
