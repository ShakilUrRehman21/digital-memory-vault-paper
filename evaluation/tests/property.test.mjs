// Property-based tests: invariants that must hold for every possible history (fast-check generates inputs).
import { test } from 'node:test';
import fc from 'fast-check';
import { computeScores, MINIMUM_HISTORY } from '../../app/lib/analytics/scores.ts';

const RUNS = Number(process.env.FC_RUNS || 200);
const decision = fc.record({
  confidence: fc.integer({ min: 1, max: 10 }),
  success: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null, freq: 5 }),
  risk: fc.constantFrom('low', 'medium', 'high'),
  emotionalState: fc.constantFrom('calm', 'stressed', 'excited', 'pressured', 'uncertain'),
  reflection: fc.option(fc.constantFrom('Fine.', 'Rushed and anxious.', 'No regrets.', 'Panic, fear, doubt, haste, regret, desperate, impulsive.'), { nil: null }),
});
const histories = fc.array(decision, { maxLength: 80 });
const SCORE_KEYS = ['decisionAccuracyScore', 'confidenceCalibrationScore', 'riskCalibrationScore', 'emotionalBiasScore', 'overconfidenceRate', 'underconfidenceRate', 'highRiskSuccessRate', 'lowRiskSuccessRate'];
const resolved = (h) => h.filter((d) => d.success !== null);

test('P1: every score is an integer between 0 and 100', () => {
  fc.assert(fc.property(histories, (h) => {
    const s = computeScores(h);
    return SCORE_KEYS.every((k) => Number.isInteger(s[k]) && s[k] >= 0 && s[k] <= 100);
  }), { numRuns: RUNS });
});

test('P2: confidence equal to success everywhere gives 100 for accuracy and both calibration scores', () => {
  fc.assert(fc.property(histories.filter((h) => resolved(h).length > 0), (h) => {
    const s = computeScores(h.map((d) => (d.success === null ? d : { ...d, confidence: d.success })));
    return s.decisionAccuracyScore === 100 && s.confidenceCalibrationScore === 100 && s.riskCalibrationScore === 100
      && s.overconfidenceRate === 0 && s.underconfidenceRate === 0 && s.calibrationError === 0;
  }), { numRuns: RUNS });
});

test('P3: calibration errors are bounded by the mean absolute per-decision error and by nine steps', () => {
  fc.assert(fc.property(histories.filter((h) => resolved(h).length > 0), (h) => {
    const s = computeScores(h);
    const r = resolved(h);
    const mae = r.reduce((a, d) => a + Math.abs(d.confidence - d.success), 0) / r.length;
    const absMean = Math.abs(r.reduce((a, d) => a + d.confidence - d.success, 0) / r.length);
    const eps = 1e-9;
    return s.calibrationError <= mae + eps && s.riskCalibrationError <= mae + eps
      && s.calibrationError >= absMean - eps && s.riskCalibrationError >= absMean - eps
      && s.calibrationError <= 9 + eps;
  }), { numRuns: RUNS });
});

test('P4: risk groups partition the resolved decisions', () => {
  fc.assert(fc.property(histories, (h) => {
    const s = computeScores(h);
    const groups = ['low', 'medium', 'high'].map((k) => s.calibrationByRisk[k]);
    const total = groups.reduce((a, g) => a + (g ? g.n : 0), 0);
    return total === resolved(h).length && s.resolvedDecisions === total
      && groups.every((g, i) => (g === null) === (resolved(h).filter((d) => d.risk === ['low', 'medium', 'high'][i]).length === 0));
  }), { numRuns: RUNS });
});

test('P5: signed mean gap equals the mean of confidence minus success', () => {
  fc.assert(fc.property(histories.filter((h) => resolved(h).length > 0), (h) => {
    const r = resolved(h);
    const m = r.reduce((a, d) => a + d.confidence - d.success, 0) / r.length;
    return Math.abs(computeScores(h).meanConfidenceGap - m) < 1e-9;
  }), { numRuns: RUNS });
});

test('P6: over- and underconfidence rates sum to at most 100, plus one point of rounding', () => {
  // The two rates are rounded separately (as in the baseline), so two half-percent shares can round up together.
  fc.assert(fc.property(histories, (h) => { const s = computeScores(h); return s.overconfidenceRate + s.underconfidenceRate <= 101; }), { numRuns: RUNS });
});

test('P7: sufficientHistory is true exactly when there are at least MINIMUM_HISTORY resolved decisions', () => {
  fc.assert(fc.property(histories, (h) => computeScores(h).sufficientHistory === (resolved(h).length >= MINIMUM_HISTORY)), { numRuns: RUNS });
});

test('P8: scores are deterministic and do not mutate their input', () => {
  fc.assert(fc.property(histories, (h) => {
    const copy = JSON.stringify(h);
    const a = JSON.stringify(computeScores(h)), b = JSON.stringify(computeScores(h));
    return a === b && JSON.stringify(h) === copy;
  }), { numRuns: RUNS });
});

test('P9: the history with no resolved decisions has zero accuracy and calibration scores', () => {
  fc.assert(fc.property(histories, (h) => {
    const s = computeScores(h.map((d) => ({ ...d, success: null })));
    return s.decisionAccuracyScore === 0 && s.confidenceCalibrationScore === 0 && s.riskCalibrationScore === 0 && s.resolvedDecisions === 0;
  }), { numRuns: RUNS });
});

test('P10: success rates by risk match the mean success rating of that group', () => {
  fc.assert(fc.property(histories, (h) => {
    const s = computeScores(h);
    const r = resolved(h);
    const rate = (k) => { const g = r.filter((d) => d.risk === k); return g.length ? Math.round((g.reduce((a, d) => a + d.success, 0) / g.length / 10) * 100) : 0; };
    return s.highRiskSuccessRate === rate('high') && s.lowRiskSuccessRate === rate('low');
  }), { numRuns: RUNS });
});
