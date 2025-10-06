// #lib/score.js

// ---- utils ----------------------------------------------------
const isDecimalObj = (v) => v && typeof v === "object" && typeof v.toNumber === "function";
const toNum = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (isDecimalObj(v)) return toNum(v.toNumber());
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// Coercer ตาม rubric
const S1 = (v) => clamp(toNum(v), 0, 10); // 0..10
const S2 = (v) => clamp(toNum(v), 0, 10); // 0..10
const S3 = (v) => clamp(toNum(v), 0, 5);  // 0..5

// ---- main -----------------------------------------------------
// type: "OPERATIONAL" | "SUPERVISOR"
export function computeScores(e, type = "OPERATIONAL") {
  // --- Section 1: Performance (ถ่วงน้ำหนัก *2,*2,*2,*1,*1) → max raw = 80 → สเกลเป็น 40%
  const s1w =
    S1(e.s1_responsibility) * 2 +
    S1(e.s1_development)    * 2 +
    S1(e.s1_workload)       * 2 +
    S1(e.s1_qualityStandard)    +
    S1(e.s1_coordination);
  const scorePerf = round2((s1w / 80) * 40);

  // --- Section 2: Result (ต่างสูตรตาม type)
  const s21 = S2(e.s2_valueOfWork);
  const s22 = S2(e.s2_customerSatisfaction);
  const s23 = S2(e.s2_costEffectiveness);
  const s24 = S2(e.s2_timeliness);

  let scoreResult;
  if (type === "OPERATIONAL") {
    // (sum * 2) / 80 * 30  → max = 30
    scoreResult = round2((((s21 + s22 + s23 + s24) * 2) / 80) * 30);
  } else {
    // SUPERVISOR: (2,2,1,1) / 50 * 40 → max = 40
    scoreResult = round2(((s21 * 2 + s22 * 2 + s23 + s24) / 50) * 40);
  }

  // --- Section 3: Competency (12 ข้อ * 0..5 = 60) → สเกลเป็น 30% (OPERATIONAL) หรือ 20% (SUPERVISOR)
  const s3sum = [
    e.s3_jobKnowledge, e.s3_attitude, e.s3_contextUnderstanding, e.s3_systematicThinking,
    e.s3_decisionMaking, e.s3_adaptability, e.s3_leadership, e.s3_verbalComm,
    e.s3_writtenComm, e.s3_selflessness, e.s3_ruleCompliance, e.s3_selfReliance,
  ].map(S3).reduce((a, b) => a + b, 0);

  const compMax = type === "OPERATIONAL" ? 30 : 20;
  const scoreComp = round2((s3sum / 60) * compMax);

  const scoreTotal = round2(scorePerf + scoreResult + scoreComp);

  // กันล้ำกรอบด้วย (เผื่อ floating เล็กน้อย)
  return {
    scorePerf:   round2(clamp(scorePerf,   0, 40)),
    scoreResult: round2(clamp(scoreResult, 0, type === "OPERATIONAL" ? 30 : 40)),
    scoreComp:   round2(clamp(scoreComp,   0, compMax)),
    scoreTotal:  round2(clamp(scoreTotal,  0, 100)),
  };
}

export function computeGrade(scoreTotal) {
  const s = toNum(scoreTotal);
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 60) return "D";
  return "E";
}

// helper: คืนค่าพร้อมสตริง 2 ตำแหน่ง (สำหรับ Prisma Decimal(5,2))
export function computeScoresForDB(e, type = "OPERATIONAL") {
  const s = computeScores(e, type);
  const to2 = (x) => round2(x).toFixed(2); // "95.00"
  return {
    numbers: s,
    strings: {
      scorePerf:   to2(s.scorePerf),
      scoreResult: to2(s.scoreResult),
      scoreComp:   to2(s.scoreComp),
      scoreTotal:  to2(s.scoreTotal),
    },
  };
}
