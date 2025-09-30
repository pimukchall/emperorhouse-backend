import { computeScores } from "#lib/score.js";

/**
 * Prisma extension ที่คอยเติมผลลัพธ์จาก computeScores
 * ให้ model `evaluation` ก่อน create/update/upsert
 */
export function evaluationScoreExtension() {
  return {
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
          const type = data.type ?? "OPERATIONAL";
          Object.assign(data, computeScores({ ...data }, type));
          args.data = data;
          return query(args);
        },
        upsert({ args, query }) {
          const createData = args.create ?? {};
          const cType = createData.type ?? "OPERATIONAL";
          Object.assign(createData, computeScores(createData, cType));
          args.create = createData;

          const updateData = args.update ?? {};
          const uType = updateData.type ?? cType ?? "OPERATIONAL";
          Object.assign(updateData, computeScores({ ...updateData }, uType));
          args.update = updateData;

          return query(args);
        },
      },
    },
  };
}
