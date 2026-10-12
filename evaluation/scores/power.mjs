// Detection power of each score as a function of history length (offline, using the pure scoring functions).
//
// For every history length n and every miscalibrated profile, R synthetic users with that profile are compared
// with R calibrated users who share the same outcomes (same seeds). For each score we report
//  * AUC: the probability that a calibrated user scores higher than a miscalibrated one (ties count half);
//  * sensitivity at 95% specificity: the share of miscalibrated users scoring at or below the highest
//    threshold that flags no more than 5% of calibrated users.
// Usage: RESULTS_DIR=... node --no-warnings scores/power.mjs
import { writeResult, environment } from '../lib/common.mjs';
import { makeProfile, history } from './model.mjs';
import { computeBaselineScores } from '../baseline-rules/baseline-scores.ts';
import { computeScores } from '../../app/lib/analytics/scores.ts';

const R = Number(process.env.REPS || 1000);
const LENGTHS = [5, 10, 15, 20, 30, 40, 60, 80, 120];
const PROFILES = [
  makeProfile('over', 1), makeProfile('over', 2), makeProfile('under', 2),
  makeProfile('inconsistent', 2), makeProfile('inconsistent', 3), makeProfile('noisy', 2),
];
const SCORES = {
  'baseline confidence calibration': (h) => computeBaselineScores(h).confidenceCalibrationScore,
  'baseline risk calibration': (h) => computeBaselineScores(h).riskCalibrationScore,
  'baseline decision accuracy': (h) => computeBaselineScores(h).decisionAccuracyScore,
  'revised confidence calibration': (h) => computeScores(h).confidenceCalibrationScore,
  'revised risk calibration': (h) => computeScores(h).riskCalibrationScore,
};

function auc(cal, mis) {
  // Mann-Whitney U via sorting; ties count half.
  const all = [...cal.map((v) => [v, 0]), ...mis.map((v) => [v, 1])].sort((a, b) => a[0] - b[0]);
  let rankSumCal = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j < all.length && all[j][0] === all[i][0]) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (all[k][1] === 0) rankSumCal += avgRank;
    i = j;
  }
  const u = rankSumCal - (cal.length * (cal.length + 1)) / 2;
  return u / (cal.length * mis.length);
}
function sensitivityAt95(cal, mis) {
  const sorted = [...new Set(cal)].sort((a, b) => a - b);
  let threshold = -Infinity;
  for (const t of sorted) {
    if (cal.filter((v) => v <= t).length / cal.length <= 0.05) threshold = t; else break;
  }
  return mis.filter((v) => v <= threshold).length / mis.length;
}

const calibrated = makeProfile('calibrated');
const rows = [];
for (const n of LENGTHS) {
  const calHist = Array.from({ length: R }, (_, i) => history(calibrated, 7000 + i, n));
  const calScores = Object.fromEntries(Object.entries(SCORES).map(([k, f]) => [k, calHist.map(f)]));
  for (const p of PROFILES) {
    const misHist = Array.from({ length: R }, (_, i) => history(p, 7000 + i, n));
    for (const [k, f] of Object.entries(SCORES)) {
      const mis = misHist.map(f);
      rows.push({ n, profile: p.label, kind: p.kind, size: p.size, score: k,
        auc: +auc(calScores[k], mis).toFixed(3), sensitivity95: +sensitivityAt95(calScores[k], mis).toFixed(3) });
    }
  }
  process.stdout.write(`n=${n} `);
}
console.log();

// Minimum history: the shortest n at which every two-step miscalibration (uniform over- or underconfidence,
// risk-dependent inconsistency, and case-to-case noise with SD 2) is flagged with at least 80% sensitivity at 95%
// specificity by at least one of the two revised calibration scores. app/lib/analytics/scores.ts uses this value.
const sens = (n, prof, score) => rows.find((r) => r.n === n && r.profile === prof && r.score === score).sensitivity95;
const twoStep = ['Overconfident (+2)', 'Underconfident (-2)', 'Inconsistent (+/-2)', 'Noisy (SD 2)'];
const perProfile = Object.fromEntries(twoStep.map((prof) => [prof,
  LENGTHS.find((n) => Math.max(sens(n, prof, 'revised confidence calibration'), sens(n, prof, 'revised risk calibration')) >= 0.8) ?? null]));
const minimumHistory = { perProfile, overall: Math.max(...Object.values(perProfile).map((v) => v ?? Infinity)) };
writeResult('power.json', { environment: environment(), repetitions: R, lengths: LENGTHS, minimumHistory, rows });
console.log('minimum history (>=80% sensitivity at 95% specificity):', minimumHistory);
for (const p of PROFILES) {
  console.log(`\n${p.label}`);
  for (const k of Object.keys(SCORES)) {
    console.log('  ' + k.padEnd(28) + LENGTHS.map((n) => rows.find((r) => r.n === n && r.profile === p.label && r.score === k).auc.toFixed(2)).join(' '));
  }
}
