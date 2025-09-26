// src/prisma.js
import { PrismaClient } from "@prisma/client";
import { computeScores } from "./lib/score.js";

const base = new PrismaClient({ log: ["query", "info", "warn", "error"] });

/**
 * ใช้ Prisma Query Extensions คำนวณ score อัตโนมัติก่อน create/update/upsert Evaluation
 */
export const prisma = base.$extends({
  query: {
    evaluation: {
      create({ args, query }) {
        const data = args.data ?? {};
        const type = data.type ?? "OPERATIONAL";
        Object.assign(data, computeScores(data, type));
        args.data = data;
        return query(args);
      },
      update({ args, query }) {
        const data = args.data ?? {};
        // ถ้ากำลังอัปเดตคะแนน/หรือฟิลด์ที่เกี่ยว ให้คำนวณใหม่เสมอ
        const type = data.type ?? "OPERATIONAL";
        Object.assign(data, computeScores({ ...data }, type));
        args.data = data;
        return query(args);
      },
      upsert({ args, query }) {
        const c = args.create ?? {};
        const cuType = c.type ?? "OPERATIONAL";
        Object.assign(c, computeScores(c, cuType));
        args.create = c;

        const u = args.update ?? {};
        const upType = u.type ?? cuType ?? "OPERATIONAL";
        Object.assign(u, computeScores({ ...u }, upType));
        args.update = u;

        return query(args);
      },
    },
  },
});
