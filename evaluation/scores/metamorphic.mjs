// Metamorphic testing of the scoring rules (offline, baseline and revised rules).
//
// A metamorphic relation (MR) states how a score must change, or must not change, when the input history is
// transformed in a known way. No oracle for the "correct" score is needed: the relation itself is the oracle.
// Each relation is checked on SOURCES randomly generated histories; we report the share of sources on which
// the relation is violated, separately for the baseline and the revised rules.
// Usage: RESULTS_DIR=... node --no-warnings scores/metamorphic.mjs
import { writeResult, environment, mulberry32, clamp10 } from '../lib/common.mjs';
import { RISKS, QUALITY } from './model.mjs';
import { computeBaselineScores } from '../baseline-rules/baseline-scores.ts';
import { computeScores } from '../../app/lib/analytics/scores.ts';

const SOURCES = Number(process.env.SOURCES || 1000);
const VERSIONS = { baseline: computeBaselineScores, revised: computeScores };
const STATES = ['calm', 'stressed', 'excited', 'pressured', 'uncertain'];
const REFLECTIONS = ['Outcome noted.', 'Went as planned.', 'I rushed it.', 'Some doubt, but fine.', 'A hasty call.', 'Calm and considered.', 'Felt anxious throughout.'];

// Source histories: a perfectly calibrated user (confidence equals the success rating) with outcomes kept
// within [lo, hi] so that shifted confidences stay on the 1-10 scale.
// With balanced = true, risk levels cycle low/medium/high and n is a multiple of three, so equal numbers of
// low- and high-risk decisions exist and opposite shifts leave the overall mean unchanged.
function source(seed, { lo = 3, hi = 8, balanced = false } = {}) {
  const rng = mulberry32(seed);
  const n = balanced ? 3 * (4 + Math.floor(rng() * 17)) : 12 + Math.floor(rng() * 49);
  const out = [];
  for (let i = 0; i < n; i++) {
    const risk = balanced ? RISKS[i % 3] : RISKS[Math.floor(rng() * 3)];
    const [qlo, qhi] = QUALITY[risk];
    const s = Math.min(hi, Math.max(lo, clamp10(qlo + (qhi - qlo) * rng() + 1.5 * (rng() - 0.5) * 2)));
    out.push({ confidence: s, success: s, risk, emotionalState: STATES[Math.floor(rng() * 5)], reflection: REFLECTIONS[Math.floor(rng() * REFLECTIONS.length)] });
  }
  return { rows: out, rng };
}
const shift = (rows, f) => rows.map((d) => ({ ...d, confidence: d.confidence + f(d) }));
const CAL = ['confidenceCalibrationScore', 'riskCalibrationScore'];
const ALL = ['decisionAccuracyScore', 'confidenceCalibrationScore', 'riskCalibrationScore', 'emotionalBiasScore'];

const RELATIONS = [
  { id: 'MR1', name: 'Uniform overconfidence lowers calibration', scores: CAL,
    desc: 'Add 2 to every confidence of a calibrated history; each calibration score must decrease.',
    check: (score, src) => { const a = score(src.rows), b = score(shift(src.rows, () => 2)); return (k) => b[k] < a[k]; } },
  { id: 'MR2a', name: 'Opposite errors by risk lower calibration (random risk mix)', scores: CAL,
    desc: 'Subtract 2 from low-risk and add 2 to high-risk confidences; each calibration score must decrease.',
    check: (score, src) => { const a = score(src.rows), b = score(shift(src.rows, (d) => (d.risk === 'low' ? -2 : d.risk === 'high' ? 2 : 0))); return (k) => b[k] < a[k]; } },
  { id: 'MR2b', name: 'Opposite errors by risk lower calibration (balanced history)', scores: CAL, opts: { balanced: true },
    desc: 'As MR2, on histories with equal numbers of low- and high-risk decisions, where the two errors cancel in the mean.',
    check: (score, src) => { const a = score(src.rows), b = score(shift(src.rows, (d) => (d.risk === 'low' ? -2 : d.risk === 'high' ? 2 : 0))); return (k) => b[k] < a[k]; } },
  { id: 'MR3', name: 'Larger bias, lower calibration', scores: CAL, opts: { lo: 3, hi: 7 },
    desc: 'Shifting every confidence by +3 must give a lower calibration score than shifting by +1.',
    check: (score, src) => { const a = score(shift(src.rows, () => 1)), b = score(shift(src.rows, () => 3)); return (k) => b[k] < a[k]; } },
  { id: 'MR4', name: 'Order invariance', scores: ALL,
    desc: 'Shuffling the order of decisions must leave every score unchanged.',
    check: (score, src) => {
      const rows = shift(src.rows, (d) => (d.risk === 'high' ? 1 : 0));
      const shuffled = [...rows].sort(() => src.rng() - 0.5);
      const a = score(rows), b = score(shuffled); return (k) => a[k] === b[k];
    } },
  { id: 'MR5', name: 'Replication invariance', scores: ALL,
    desc: 'Duplicating the whole history must leave every score unchanged.',
    check: (score, src) => { const rows = shift(src.rows, (d) => (d.risk === 'low' ? -1 : 0)); const a = score(rows), b = score([...rows, ...rows]); return (k) => a[k] === b[k]; } },
  { id: 'MR6', name: 'Pending decisions do not affect calibration', scores: ['decisionAccuracyScore', ...CAL],
    desc: 'Adding pending decisions (no outcome yet) must leave accuracy and calibration scores unchanged.',
    check: (score, src) => {
      const pend = Array.from({ length: 5 }, (_, i) => ({ confidence: 1 + Math.floor(src.rng() * 10), success: null, risk: RISKS[i % 3], emotionalState: 'calm', reflection: null }));
      const a = score(src.rows), b = score([...src.rows, ...pend]); return (k) => a[k] === b[k];
    } },
  { id: 'MR7', name: 'Negated warning words add no bias', scores: ['emotionalBiasScore'],
    desc: 'Appending "No regrets, not anxious." to every reflection must not increase emotional bias.',
    check: (score, src) => { const a = score(src.rows), b = score(src.rows.map((d) => ({ ...d, reflection: `${d.reflection} No regrets, not anxious.` }))); return (k) => b[k] <= a[k]; } },
  { id: 'MR8', name: 'Words that merely contain a warning word add no bias', scores: ['emotionalBiasScore'],
    desc: 'Appending "Fearless and undoubtedly sound." must not increase emotional bias.',
    check: (score, src) => { const a = score(src.rows), b = score(src.rows.map((d) => ({ ...d, reflection: `${d.reflection} Fearless and undoubtedly sound.` }))); return (k) => b[k] <= a[k]; } },
  { id: 'MR9', name: 'Inflected warning words are recognised', scores: ['emotionalBiasScore'],
    desc: 'Appending "Panicked and regretted it." to calm, otherwise neutral reflections must increase emotional bias.',
    check: (score, src) => {
      const base = src.rows.map((d) => ({ ...d, emotionalState: 'calm', reflection: 'Outcome noted.' }));
      const a = score(base), b = score(base.map((d) => ({ ...d, reflection: 'Panicked and regretted it.' }))); return (k) => b[k] > a[k];
    } },
];

const results = [];
for (const mr of RELATIONS) {
  for (const [version, score] of Object.entries(VERSIONS)) {
    const violations = Object.fromEntries(mr.scores.map((k) => [k, 0]));
    for (let i = 0; i < SOURCES; i++) {
      const holds = mr.check(score, source(20000 + i, mr.opts));
      for (const k of mr.scores) if (!holds(k)) violations[k]++;
    }
    for (const k of mr.scores) results.push({ id: mr.id, relation: mr.name, description: mr.desc, version, score: k, violations: violations[k], sources: SOURCES, rate: +(violations[k] / SOURCES).toFixed(3) });
  }
}
writeResult('metamorphic.json', { environment: environment(), sources: SOURCES, results });
for (const r of results) console.log(`${r.id} ${r.version} ${r.score.padEnd(28)} ${(100 * r.rate).toFixed(1).padStart(5)}%  ${r.relation}`);
