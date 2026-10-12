// Example-based unit tests for lib/analytics/scores.ts: fixed inputs with hand-computed expected values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScores, warningWordsIn, emotionalBiasPoints, MINIMUM_HISTORY } from '../../app/lib/analytics/scores.ts';

const d = (confidence, success, risk = 'medium', emotionalState = 'calm', reflection = 'Outcome noted.') => ({ confidence, success, risk, emotionalState, reflection });

// The ten decisions of the worked example (paper, Table 3).
const WORKED = [
  d(8, 9, 'medium', 'calm', 'Took time to compare offers.'),
  d(7, 7, 'low', 'excited', 'Worked out as planned.'),
  d(9, 3, 'high', 'pressured', 'We rushed the launch.'),
  d(6, 8, 'low', 'calm', 'Better than expected.'),
  d(7, 5, 'medium', 'uncertain', 'Some doubt about the location.'),
  d(8, 4, 'high', 'stressed', 'A panic move, and hasty.'),
  d(5, 8, 'medium', 'calm', 'Glad I applied.'),
  d(6, 6, 'medium', 'calm', 'As expected.'),
  d(9, 5, 'medium', 'excited', 'Impulsive hire; some regret.'),
  d(7, 8, 'low', 'calm', 'Useful course.'),
];

test('worked example: all scores match hand calculation', () => {
  const s = computeScores(WORKED);
  assert.equal(s.decisionAccuracyScore, 77); // 770 / 10
  // Bins: c5 {8} gap 3; c6 {8,6} gap 1; c7 {7,5,8} gap 0.33; c8 {9,4} gap 1.5; c9 {3,5} gap 5 -> (3+2+1+3+10)/10 = 1.9
  assert.equal(s.confidenceCalibrationScore, 81);
  assert.ok(Math.abs(s.calibrationError - 1.9) < 1e-9);
  // Risk: low c(7,6,7) s(7,8,8) gap -1 (n3); medium c(8,7,5,6,9) s(9,5,8,6,5) gap 0.4 (n5); high gap 5 (n2) -> 1.5
  assert.equal(s.riskCalibrationScore, 85);
  assert.ok(Math.abs(s.riskCalibrationError - 1.5) < 1e-9);
  assert.equal(s.calibrationByRisk.high.gap, 5);
  assert.deepEqual(s.calibrationByRisk.low, { n: 3, meanConfidence: 20 / 3, meanSuccess: 23 / 3, gap: -1 });
  assert.equal(s.calibrationByRisk.high.meanConfidence, 8.5);
  assert.equal(s.calibrationByRisk.high.meanSuccess, 3.5);
  assert.equal(s.calibrationByRisk.medium.n, 5);
  // Bias points: 0, 40, 50, 0, 50, 60, 0, 0, 60, 0 -> 26
  assert.equal(s.emotionalBiasScore, 26);
  assert.equal(s.overconfidenceRate, 40);
  assert.equal(s.underconfidenceRate, 20);
  assert.equal(s.highRiskSuccessRate, 35);
  assert.equal(s.lowRiskSuccessRate, 77);
  assert.ok(Math.abs(s.meanConfidenceGap - 0.9) < 1e-9);
  assert.equal(s.resolvedDecisions, 10);
  assert.equal(s.sufficientHistory, false);
});

test('empty history gives zero scores and no history', () => {
  const s = computeScores([]);
  assert.equal(s.decisionAccuracyScore, 0);
  assert.equal(s.confidenceCalibrationScore, 0);
  assert.equal(s.riskCalibrationScore, 0);
  assert.equal(s.emotionalBiasScore, 0);
  assert.equal(s.resolvedDecisions, 0);
  assert.equal(s.sufficientHistory, false);
  assert.deepEqual(s.calibrationByRisk, { low: null, medium: null, high: null });
});

test('a missing success rating (undefined) is treated as pending', () => {
  const s = computeScores([{ confidence: 7, risk: 'low', emotionalState: 'calm' }, d(6, 6, 'low')]);
  assert.equal(s.resolvedDecisions, 1);
  assert.equal(s.confidenceCalibrationScore, 100);
});

test('pending decisions count for emotional bias only', () => {
  const s = computeScores([d(7, null, 'low', 'stressed', null), d(5, null, 'high', 'calm', null)]);
  assert.equal(s.resolvedDecisions, 0);
  assert.equal(s.confidenceCalibrationScore, 0);
  assert.equal(s.emotionalBiasScore, 20);
});

test('single decision', () => {
  const s = computeScores([d(8, 5, 'high')]);
  assert.equal(s.decisionAccuracyScore, 70);
  assert.equal(s.confidenceCalibrationScore, 70);
  assert.equal(s.riskCalibrationScore, 70);
  assert.equal(s.overconfidenceRate, 100);
  assert.equal(s.underconfidenceRate, 0);
  assert.equal(s.highRiskSuccessRate, 50);
  assert.equal(s.lowRiskSuccessRate, 0);
});

test('one-step differences count as neither over- nor underconfident', () => {
  const s = computeScores([d(6, 5), d(5, 6), d(5, 5)]);
  assert.equal(s.overconfidenceRate, 0);
  assert.equal(s.underconfidenceRate, 0);
  const t = computeScores([d(7, 5), d(3, 5), d(5, 5), d(5, 5)]);
  assert.equal(t.overconfidenceRate, 25);
  assert.equal(t.underconfidenceRate, 25);
});

test('largest possible error (nine steps) gives 10 points', () => {
  const s = computeScores([d(10, 1, 'low'), d(10, 1, 'high')]);
  assert.equal(s.decisionAccuracyScore, 10);
  assert.equal(s.confidenceCalibrationScore, 10);
  assert.equal(s.riskCalibrationScore, 10);
  assert.equal(s.calibrationError, 9);
});

test('opposite errors at different confidence levels do not cancel', () => {
  // Low risk: said 5, got 8. High risk: said 8, got 5. Mean gap is zero.
  const s = computeScores([d(5, 8, 'low'), d(8, 5, 'high')]);
  assert.equal(s.meanConfidenceGap, 0);
  assert.equal(s.confidenceCalibrationScore, 70);
  assert.equal(s.riskCalibrationScore, 70);
});

test('emotional bias: states, words, cap and negation', () => {
  assert.equal(emotionalBiasPoints(d(5, 5, 'low', 'calm', 'Fine.')), 0);
  assert.equal(emotionalBiasPoints(d(5, 5, 'low', 'excited', 'Fine.')), 40);
  assert.equal(emotionalBiasPoints(d(5, 5, 'low', 'stressed', 'Rushed, anxious, panic, fear, hasty, regret, doubt.')), 100);
  assert.equal(emotionalBiasPoints(d(5, 5, 'low', 'calm', 'Rushed and rushed again.')), 10);
  assert.deepEqual(warningWordsIn('No regrets at all.'), []);
  assert.deepEqual(warningWordsIn('I was not anxious.'), []);
  assert.deepEqual(warningWordsIn('A fearless choice.'), []);
  assert.deepEqual(warningWordsIn('I regretted it.'), ['regret']);
  assert.deepEqual(warningWordsIn("Didn't panic, but felt rushed."), ['rushed']);
  assert.deepEqual(warningWordsIn('Fears and doubts.').sort(), ['doubt', 'fear']);
  assert.deepEqual(warningWordsIn('Undoubtedly right.'), []);
});

test('every negation word suppresses a following warning word', () => {
  for (const neg of ['no', 'not', 'never', 'without', 'zero', 'nor', "didn't", "don't", "wasn't", "isn't", "weren't", 'didnt', 'dont', 'wasnt', 'isnt']) {
    assert.deepEqual(warningWordsIn(`${neg} panic`), [], neg);
    assert.deepEqual(warningWordsIn(`${neg} a b c panic`), ['panic'], `${neg} outside the window`);
  }
  assert.deepEqual(warningWordsIn('I didn’t panic.'), [], 'typographic apostrophe');
  assert.deepEqual(warningWordsIn('I didn`t panic.'), [], 'backtick apostrophe');
});

test('every inflection of a warning word is recognised, other suffixes are not', () => {
  const forms = { doubt: ['doubts', 'doubted', 'doubting', 'doubtful', 'doubtfully'], regret: ['regretted', 'regretting', 'regretful'],
    panic: ['panicked', 'panicking'], hasty: [], rush: [], fear: ['fears', 'feared', 'fearful', 'fearfulness'],
    impulsive: ['impulsiveness', 'impulsively'], reactive: ['reactively'], desperate: ['desperately'], anxious: ['anxiousness', 'anxiously'], pressured: [], overconfident: [] };
  for (const [word, list] of Object.entries(forms)) for (const f of list) assert.deepEqual(warningWordsIn(f), [word], f);
  assert.deepEqual(warningWordsIn('pressureds'), ['pressured']);
  assert.deepEqual(warningWordsIn('hastyes'), ['hasty']);
  assert.deepEqual(warningWordsIn('rushedd'), ['rushed']);
  for (const w of ['fearless', 'doubtless', 'panicky', 'regrettable', 'rushes']) assert.deepEqual(warningWordsIn(w), [], w);
  assert.deepEqual(warningWordsIn('rushed pressured anxious overconfident doubt reactive panic fear desperate impulsive hasty regret').length, 12);
});

test('each non-calm state adds 40 points', () => {
  for (const st of ['stressed', 'pressured', 'uncertain', 'excited']) assert.equal(emotionalBiasPoints(d(5, 5, 'low', st, 'Fine.')), 40, st);
});

test('minimum history threshold', () => {
  const h = (n) => Array.from({ length: n }, () => d(5, 5));
  assert.equal(computeScores(h(MINIMUM_HISTORY - 1)).sufficientHistory, false);
  assert.equal(computeScores(h(MINIMUM_HISTORY)).sufficientHistory, true);
  assert.equal(MINIMUM_HISTORY, 20);
});
