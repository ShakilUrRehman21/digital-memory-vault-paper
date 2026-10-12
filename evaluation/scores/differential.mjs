// End-to-end simulation through the running API, with a differential check against the pure scoring functions.
//
// Enters the noisy-reporter simulation (4 profiles x 25 users x 40 decisions, identical seeds) through the
// HTTP API of the build under test, reads the scores from GET /api/analytics, and compares every score with
// the pure implementation of the same rules run on the same inputs (VERSION=baseline uses
// evaluation/baseline-rules/baseline-scores.ts, VERSION=revised uses app/lib/analytics/scores.ts). A mismatch would mean that the
// offline experiments do not describe what the application actually computes.
// Also enters the ten worked-example decisions and records the scores returned.
// Usage: BASE_URL=... VERSION=baseline|revised LABEL=baseline RESULTS_DIR=... node --no-warnings scores/differential.mjs
import { call, newUser, writeResult, mean, sd, LABEL, environment } from '../lib/common.mjs';
import { NOISY_PROFILES, noisyHistory } from './model.mjs';
import { computeBaselineScores } from '../baseline-rules/baseline-scores.ts';
import { computeScores } from '../../app/lib/analytics/scores.ts';

const VERSION = process.env.VERSION || 'revised';
const pure = VERSION === 'baseline' ? computeBaselineScores : computeScores;
const KEYS = ['decisionAccuracyScore', 'confidenceCalibrationScore', 'riskCalibrationScore', 'emotionalBiasScore', 'overconfidenceRate', 'underconfidenceRate'];
const USERS = Number(process.env.USERS || 25), N = 40;

async function enter(token, rows) {
  for (const d of rows) {
    const r = await call('POST', '/api/decisions', { token, body: {
      title: d.title || 'Simulated decision', category: 'product', description: 'Synthetic decision for simulation.',
      expectedOutcome: 'Synthetic expected outcome.', confidenceLevel: d.confidence, emotionalState: d.emotionalState,
      riskLevel: d.risk, decisionDate: '2026-09-01' } });
    if (r.status !== 201) throw new Error(`decision ${r.status} ${r.text}`);
    if (d.success != null) {
      const o = await call('POST', `/api/decisions/${r.json.decision.id}/outcome`, { token, body: {
        actualOutcome: 'Synthetic outcome recorded.', successRating: d.success, lessonLearned: 'Synthetic.', reflection: d.reflection } });
      if (o.status !== 201) throw new Error(`outcome ${o.status} ${o.text}`);
    }
  }
  return (await call('GET', '/api/analytics', { token })).json;
}

const users = [];
let mismatches = 0;
for (const p of NOISY_PROFILES) {
  for (let u = 0; u < USERS; u++) {
    const rows = noisyHistory(p, 1000 + u, N);
    const { token } = await newUser(`sim-${p.name}-${u}`);
    const api = await enter(token, rows);
    const ref = pure(rows);
    const diff = KEYS.filter((k) => api[k] !== ref[k]);
    mismatches += diff.length;
    users.push({ profile: p.name, user: u, meanGap: mean(rows.map((d) => d.confidence - d.success)),
      ...Object.fromEntries(KEYS.map((k) => [k, api[k]])), mismatched: diff });
  }
  console.log('done', p.name);
}

const WORKED = [
  ['Accept internship offer', 'medium', 'calm', 8, 9, 'Took time to compare offers.'],
  ['Buy a laptop on instalments', 'low', 'excited', 7, 7, 'Worked out as planned.'],
  ['Launch feature without user testing', 'high', 'pressured', 9, 3, 'We rushed the launch.'],
  ['Join a morning gym batch', 'low', 'calm', 6, 8, 'Better than expected.'],
  ['Move to a shared flat', 'medium', 'uncertain', 7, 5, 'Some doubt about the location.'],
  ['Switch database provider mid-sprint', 'high', 'stressed', 8, 4, 'A panic move, and hasty.'],
  ['Apply for a hackathon', 'medium', 'calm', 5, 8, 'Glad I applied.'],
  ['Invest savings in an index fund', 'medium', 'calm', 6, 6, 'As expected.'],
  ['Hire a freelance designer', 'medium', 'excited', 9, 5, 'Impulsive hire; some regret.'],
  ['Start a weekend course', 'low', 'calm', 7, 8, 'Useful course.'],
].map(([title, risk, emotionalState, confidence, success, reflection]) => ({ title, risk, emotionalState, confidence, success, reflection }));
const { token } = await newUser('worked');
const worked = await enter(token, WORKED);
const workedRef = pure(WORKED);
const workedMismatch = KEYS.filter((k) => worked[k] !== workedRef[k]);

const summary = {};
for (const p of NOISY_PROFILES) {
  const r = users.filter((x) => x.profile === p.name);
  summary[p.name] = Object.fromEntries(['meanGap', ...KEYS].map((k) => [k, { mean: +mean(r.map((x) => x[k])).toFixed(2), sd: +sd(r.map((x) => x[k])).toFixed(2) }]));
}
writeResult(`differential-${LABEL}.json`, {
  label: LABEL, version: VERSION, environment: environment(), usersPerProfile: USERS, decisionsPerUser: N,
  mismatchedValues: mismatches + workedMismatch.length, comparedValues: (users.length + 1) * KEYS.length,
  summary, workedExample: { api: worked, pure: workedRef, mismatched: workedMismatch }, users,
});
console.log(JSON.stringify(summary, null, 1));
console.log('worked example', KEYS.map((k) => `${k}=${worked[k]}`).join(' '));
console.log(`mismatched values: ${mismatches + workedMismatch.length} of ${(users.length + 1) * KEYS.length}`);
