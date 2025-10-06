import 'dotenv/config';

import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`Server started on port ${env.PORT} (${env.NODE_ENV})`);
  if (env.NODE_ENV !== "production") {
    console.log(`- Frontend URL: ${env.FRONTEND_BASE_URL}`);
  }
});

/** ปรับ timeout เพื่อกัน connection ค้างตอนปิด */
server.keepAliveTimeout = 65_000; // > default 5s
server.headersTimeout = 66_000;   // > keepAliveTimeout เล็กน้อย

const SHUTDOWN_TIMEOUT_MS = 10_000;
let isShuttingDown = false;

async function gracefulShutdown(reason, err) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (err) console.error(`[shutdown:${reason}]`, err);
  else console.log(`[shutdown:${reason}] starting graceful shutdown...`);

  const hardExitTimer = setTimeout(() => {
    console.error("[shutdown] forced exit due to timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  hardExitTimer.unref();

  try {
    await new Promise((resolve) => server.close(resolve));
    console.log("[shutdown] http server closed");

    await prisma.$disconnect();
    console.log("[shutdown] prisma disconnected");

    process.exit(0);
  } catch (e) {
    console.error("[shutdown] error while shutting down:", e);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => gracefulShutdown("uncaughtException", err));
process.on("unhandledRejection", (reason) => gracefulShutdown("unhandledRejection", reason));
