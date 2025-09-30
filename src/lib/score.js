export function computeScores(e, type = "OPERATIONAL") {
  const n = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

  const s1w = n(e.s1_responsibility) * 2 + n(e.s1_development) * 2 + n(e.s1_workload) * 2
            + n(e.s1_qualityStandard) + n(e.s1_coordination);
  const scorePerf = (s1w / 80) * 40;

  const s21 = n(e.s2_valueOfWork), s22 = n(e.s2_customerSatisfaction),
        s23 = n(e.s2_costEffectiveness), s24 = n(e.s2_timeliness);
  let scoreResult = 0;
  if (type === "OPERATIONAL") {
    scoreResult = (((s21 + s22 + s23 + s24) * 2) / 80) * 30;
  } else {
    scoreResult = ((s21 * 2 + s22 * 2 + s23 + s24) / 50) * 40;
  }

  const s3sum = [
    e.s3_jobKnowledge, e.s3_attitude, e.s3_contextUnderstanding, e.s3_systematicThinking,
    e.s3_decisionMaking, e.s3_adaptability, e.s3_leadership, e.s3_verbalComm,
    e.s3_writtenComm, e.s3_selflessness, e.s3_ruleCompliance, e.s3_selfReliance,
  ].map(n).reduce((a, b) => a + b, 0);
  const scoreComp = (s3sum / 60) * (type === "OPERATIONAL" ? 30 : 20);

  return { scorePerf, scoreResult, scoreComp, scoreTotal: scorePerf + scoreResult + scoreComp };
}

export function computeGrade(scoreTotal) {
  if (scoreTotal >= 90) return "A";
  if (scoreTotal >= 80) return "B";
  if (scoreTotal >= 70) return "C";
  if (scoreTotal >= 60) return "D";
  return "E";
}
