// Metamorphic relations as executable tests (fast-check generates the source histories).
// Each relation is described in evaluation/scores/metamorphic.mjs and in the paper (Table 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { computeScores } from '../../app/lib/analytics/scores.ts';

const RUNS = Number(process.env.FC_RUNS || 200);
const risk = fc.constantFrom('low', 'medium', 'high');
const state = fc.constantFrom('calm', 'stressed', 'excited', 'pressured', 'uncertain');
const reflection = fc.constantFrom('Outcome noted.', 'Went as planned.', 'I rushed it.', 'Some doubt.', 'Felt anxious.');
// Perfectly calibrated history: confidence equals success, success within [lo, hi].
const calibrated = (lo, hi, minLength = 3) => fc.array(
  fc.record({ s: fc.integer({ min: lo, max: hi }), risk, emotionalState: state, reflection }), { minLength, maxLength: 60 },
).map((xs) => xs.map(({ s, ...rest }) => ({ confidence: s, success: s, ...rest })));
// Balanced: the same number of low- and high-risk decisions.
const balanced = fc.array(fc.tuple(fc.integer({ min: 3, max: 8 }), fc.integer({ min: 3, max: 8 }), fc.integer({ min: 3, max: 8 })), { minLength: 1, maxLength: 20 })
  .map((ts) => ts.flatMap(([a, b, c]) => [
    { confidence: a, success: a, risk: 'low', emotionalState: 'calm', reflection: 'Noted.' },
    { confidence: b, success: b, risk: 'medium', emotionalState: 'calm', reflection: 'Noted.' },
    { confidence: c, success: c, risk: 'high', emotionalState: 'calm', reflection: 'Noted.' },
  ]));
const shift = (rows, f) => rows.map((d) => ({ ...d, confidence: d.confidence + f(d) }));
const opposite = (d) => (d.risk === 'low' ? -2 : d.risk === 'high' ? 2 : 0);
const hasLowAndHigh = (rows) => rows.some((d) => d.risk === 'low') && rows.some((d) => d.risk === 'high');

test('MR1: uniform overconfidence lowers both calibration scores', () => {
  fc.assert(fc.property(calibrated(1, 8), (rows) => {
    const a = computeScores(rows), b = computeScores(shift(rows, () => 2));
    return b.confidenceCalibrationScore < a.confidenceCalibrationScore && b.riskCalibrationScore < a.riskCalibrationScore;
  }), { numRuns: RUNS });
});

test('MR2: opposite errors by risk level lower risk calibration', () => {
  fc.assert(fc.property(calibrated(3, 8).filter(hasLowAndHigh), (rows) =>
    computeScores(shift(rows, opposite)).riskCalibrationScore < computeScores(rows).riskCalibrationScore), { numRuns: RUNS });
});

test('MR2b: on balanced histories, opposite errors lower risk calibration even though the mean gap is unchanged', () => {
  fc.assert(fc.property(balanced, (rows) => {
    const a = computeScores(rows), b = computeScores(shift(rows, opposite));
    return Math.abs(b.meanConfidenceGap - a.meanConfidenceGap) < 1e-9 && b.riskCalibrationScore < a.riskCalibrationScore;
  }), { numRuns: RUNS });
});

test('MR3: a larger uniform bias gives lower calibration scores', () => {
  fc.assert(fc.property(calibrated(1, 7), (rows) => {
    const a = computeScores(shift(rows, () => 1)), b = computeScores(shift(rows, () => 3));
    return b.confidenceCalibrationScore < a.confidenceCalibrationScore && b.riskCalibrationScore < a.riskCalibrationScore
      && b.decisionAccuracyScore < a.decisionAccuracyScore;
  }), { numRuns: RUNS });
});

test('MR4: scores do not depend on the order of decisions', () => {
  fc.assert(fc.property(calibrated(1, 10, 1).map((r) => shift(r, (d) => (d.risk === 'high' && d.confidence < 10 ? 1 : 0))), fc.integer(), (rows, seed) => {
    const shuffled = [...rows].map((d, i) => [((seed * 31 + i * 7919) >>> 0) % 1000, d]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    assert.deepEqual(computeScores(shuffled), computeScores(rows));
  }), { numRuns: RUNS });
});

test('MR5: duplicating the history leaves every score unchanged', () => {
  fc.assert(fc.property(calibrated(2, 10, 1).map((r) => shift(r, (d) => (d.risk === 'low' ? -1 : 0))), (rows) => {
    const a = computeScores(rows), b = computeScores([...rows, ...rows]);
    for (const k of ['decisionAccuracyScore', 'confidenceCalibrationScore', 'riskCalibrationScore', 'emotionalBiasScore', 'overconfidenceRate', 'underconfidenceRate', 'highRiskSuccessRate', 'lowRiskSuccessRate']) {
      if (a[k] !== b[k]) return false;
    }
    return Math.abs(a.calibrationError - b.calibrationError) < 1e-9 && Math.abs(a.riskCalibrationError - b.riskCalibrationError) < 1e-9;
  }), { numRuns: RUNS });
});

test('MR6: pending decisions leave accuracy and calibration unchanged', () => {
  fc.assert(fc.property(calibrated(1, 10, 1), fc.array(fc.record({ confidence: fc.integer({ min: 1, max: 10 }), risk }), { minLength: 1, maxLength: 5 }), (rows, pend) => {
    const extra = pend.map((p) => ({ ...p, success: null, emotionalState: 'calm', reflection: null }));
    const a = computeScores(rows), b = computeScores([...rows, ...extra]);
    return a.decisionAccuracyScore === b.decisionAccuracyScore && a.confidenceCalibrationScore === b.confidenceCalibrationScore
      && a.riskCalibrationScore === b.riskCalibrationScore && a.overconfidenceRate === b.overconfidenceRate && b.resolvedDecisions === a.resolvedDecisions;
  }), { numRuns: RUNS });
});

test('MR7: negated warning words do not increase emotional bias', () => {
  fc.assert(fc.property(calibrated(1, 10, 1), (rows) =>
    computeScores(rows.map((d) => ({ ...d, reflection: `${d.reflection} No regrets, not anxious, never rushed.` }))).emotionalBiasScore
      <= computeScores(rows).emotionalBiasScore), { numRuns: RUNS });
});

test('MR8: words that merely contain a warning word do not increase emotional bias', () => {
  fc.assert(fc.property(calibrated(1, 10, 1), (rows) =>
    computeScores(rows.map((d) => ({ ...d, reflection: `${d.reflection} Fearless and undoubtedly sound.` }))).emotionalBiasScore
      <= computeScores(rows).emotionalBiasScore), { numRuns: RUNS });
});

test('MR9: inflected warning words are recognised', () => {
  fc.assert(fc.property(calibrated(1, 10, 1), (rows) => {
    const base = rows.map((d) => ({ ...d, emotionalState: 'calm', reflection: 'Outcome noted.' }));
    return computeScores(base.map((d) => ({ ...d, reflection: 'Panicked and regretted it.' }))).emotionalBiasScore
      > computeScores(base).emotionalBiasScore;
  }), { numRuns: RUNS });
});

test('MR10: making a non-calm state calm never increases emotional bias', () => {
  fc.assert(fc.property(calibrated(1, 10, 1), (rows) =>
    computeScores(rows.map((d) => ({ ...d, emotionalState: 'calm' }))).emotionalBiasScore <= computeScores(rows).emotionalBiasScore), { numRuns: RUNS });
});
