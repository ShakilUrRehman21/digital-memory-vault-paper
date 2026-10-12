// A worked-example check: the eight values reported for the ten-decision worked example
// (computed with the revised rules) and the empty-history case. Used as the baseline test set in mutation testing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScores } from '../../app/lib/analytics/scores.ts';

const d = (confidence, success, risk, emotionalState, reflection) => ({ confidence, success, risk, emotionalState, reflection });
const WORKED = [
  d(8, 9, 'medium', 'calm', 'Took time to compare offers.'), d(7, 7, 'low', 'excited', 'Worked out as planned.'),
  d(9, 3, 'high', 'pressured', 'We rushed the launch.'), d(6, 8, 'low', 'calm', 'Better than expected.'),
  d(7, 5, 'medium', 'uncertain', 'Some doubt about the location.'), d(8, 4, 'high', 'stressed', 'A panic move, and hasty.'),
  d(5, 8, 'medium', 'calm', 'Glad I applied.'), d(6, 6, 'medium', 'calm', 'As expected.'),
  d(9, 5, 'medium', 'excited', 'Impulsive hire; some regret.'), d(7, 8, 'low', 'calm', 'Useful course.'),
];

test('worked example: the eight reported values', () => {
  const s = computeScores(WORKED);
  assert.deepEqual(
    [s.decisionAccuracyScore, s.confidenceCalibrationScore, s.riskCalibrationScore, s.emotionalBiasScore,
      s.overconfidenceRate, s.underconfidenceRate, s.highRiskSuccessRate, s.lowRiskSuccessRate],
    [77, 81, 85, 26, 40, 20, 35, 77]);
});

test('no decisions: all scores zero', () => {
  const s = computeScores([]);
  assert.deepEqual([s.decisionAccuracyScore, s.confidenceCalibrationScore, s.riskCalibrationScore, s.emotionalBiasScore], [0, 0, 0, 0]);
});
