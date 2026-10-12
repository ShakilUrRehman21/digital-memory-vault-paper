// Replay of real human forecasts through the baseline and revised scoring rules.
//
// Data: 4,797 resolved forecasts by 40 superforecasters from ForecastBench (data/forecastbench-superforecasters.csv,
// CC BY-SA 4.0). Each forecast is a probability p for a binary outcome y. To feed them to the application's rules,
// p is mapped to the 1-10 confidence scale as c = 1 + round(9p) and the outcome to a success rating of 10 (y = 1)
// or 1 (y = 0); a forecaster who is calibrated in probability terms is then calibrated on the 1-10 scale.
// The question domain (market, economic data, event data) takes the place of the risk level as the grouping
// variable, because it is known when the forecast is made.
//
// Each application score is compared with an established reference measure computed from the raw probabilities:
// expected calibration error over ten equal-width bins (ECE), Murphy's reliability term, calibration-in-the-large
// (mean p minus mean y) and the domain-conditional calibration error (DCE). We report Spearman correlations across
// forecasters with bootstrap confidence intervals, agreement with the reference under controlled distortions of the
// real forecasts, and how the agreement grows with history length.
// Usage: RESULTS_DIR=... node --no-warnings scores/replay.mjs
import fs from 'node:fs';
import { writeResult, environment, mulberry32, mean } from '../lib/common.mjs';
import { computeBaselineScores } from '../baseline-rules/baseline-scores.ts';
import { computeScores } from '../../app/lib/analytics/scores.ts';

const MIN_FORECASTS = 20;
const BOOT = Number(process.env.BOOT || 2000);
const DOMAIN_TO_GROUP = { market: 'low', economic: 'medium', event: 'high' };

const lines = fs.readFileSync(new URL('../data/forecastbench-superforecasters.csv', import.meta.url), 'utf8').trim().split('\n').slice(1);
const byForecaster = new Map();
for (const line of lines) {
  const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
  const [forecaster, , source, domain, , prob, outcome] = cols;
  if (!byForecaster.has(forecaster)) byForecaster.set(forecaster, []);
  byForecaster.get(forecaster).push({ p: Number(prob), y: Number(outcome), domain, source });
}
const forecasters = [...byForecaster.entries()].filter(([, f]) => f.length >= MIN_FORECASTS);

const toApp = (fs_) => fs_.map((f) => ({
  confidence: 1 + Math.round(9 * Math.min(1, Math.max(0, f.p))), success: f.y === 1 ? 10 : 1,
  risk: DOMAIN_TO_GROUP[f.domain], emotionalState: 'calm', reflection: 'Forecast resolved.',
}));
function reference(fs_) {
  const n = fs_.length;
  const bins = Array.from({ length: 10 }, () => []);
  for (const f of fs_) bins[Math.min(9, Math.floor(f.p * 10))].push(f);
  let ece = 0, rel = 0;
  for (const b of bins) if (b.length) {
    const g = mean(b.map((f) => f.p)) - mean(b.map((f) => f.y));
    ece += (b.length / n) * Math.abs(g); rel += (b.length / n) * g * g;
  }
  let dce = 0;
  for (const dom of ['market', 'economic', 'event']) {
    const g = fs_.filter((f) => f.domain === dom);
    if (g.length) dce += (g.length / n) * Math.abs(mean(g.map((f) => f.p)) - mean(g.map((f) => f.y)));
  }
  return { n, brier: mean(fs_.map((f) => (f.p - f.y) ** 2)), ece, reliability: rel,
    citl: mean(fs_.map((f) => f.p)) - mean(fs_.map((f) => f.y)), dce, baseRate: mean(fs_.map((f) => f.y)) };
}
function scores(fs_) {
  const a = toApp(fs_), b = computeBaselineScores(a), r = computeScores(a);
  return { baselinecc: b.confidenceCalibrationScore, baselinerc: b.riskCalibrationScore, baselineda: b.decisionAccuracyScore,
    revisedcc: r.confidenceCalibrationScore, revisedrc: r.riskCalibrationScore, revisedce: r.calibrationError, revisedrce: r.riskCalibrationError };
}

function ranks(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    for (let k = i; k < j; k++) r[idx[k][1]] = (i + j + 1) / 2;
    i = j;
  }
  return r;
}
function spearman(a, b) {
  const ra = ranks(a), rb = ranks(b), ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}
function bootCI(a, b, seed = 1) {
  const rng = mulberry32(seed), n = a.length, vals = [];
  for (let k = 0; k < BOOT; k++) {
    const ia = Array.from({ length: n }, () => Math.floor(rng() * n));
    vals.push(spearman(ia.map((i) => a[i]), ia.map((i) => b[i])));
  }
  vals.sort((x, y) => x - y);
  return [vals[Math.floor(0.025 * BOOT)], vals[Math.floor(0.975 * BOOT)]];
}

// 1. Per-forecaster scores and reference measures.
const table = forecasters.map(([id, f]) => ({ forecaster: id, ...reference(f), ...scores(f) }));
const col = (k) => table.map((r) => r[k]);
const absCitl = table.map((r) => Math.abs(r.citl));
const pairs = [
  ['baseline confidence calibration', 'baselinecc', 'ECE', 'ece'], ['revised confidence calibration', 'revisedcc', 'ECE', 'ece'],
  ['baseline confidence calibration', 'baselinecc', 'reliability', 'reliability'], ['revised confidence calibration', 'revisedcc', 'reliability', 'reliability'],
  ['baseline confidence calibration', 'baselinecc', '|calibration-in-the-large|', 'abscitl'],
  ['baseline risk calibration', 'baselinerc', 'domain calibration error', 'dce'], ['revised risk calibration', 'revisedrc', 'domain calibration error', 'dce'],
  ['baseline risk calibration', 'baselinerc', 'outcome base rate', 'baseRate'], ['revised risk calibration', 'revisedrc', 'outcome base rate', 'baseRate'],
];
const correlations = pairs.map(([sl, sk, rl, rk], i) => {
  const ref = rk === 'abscitl' ? absCitl : col(rk);
  const rho = spearman(col(sk), ref);
  return { score: sl, reference: rl, rho: +rho.toFixed(3), ci95: bootCI(col(sk), ref, 100 + i).map((x) => +x.toFixed(3)) };
});

// 2. Controlled distortions of the real forecasts. For each forecaster and distortion, does the score move in the
//    direction that the reference error moves? (Score should fall when the reference error rises, and vice versa.)
const clip = (p) => Math.min(1, Math.max(0, p));
const logit = (p) => Math.log(p / (1 - p)), expit = (x) => 1 / (1 + Math.exp(-x));
const DISTORTIONS = [
  { id: 'D1', name: 'Uniform overconfidence: p + 0.2', ref: 'ece', f: (x) => ({ ...x, p: clip(x.p + 0.2) }) },
  { id: 'D2', name: 'Uniform underconfidence: p - 0.2', ref: 'ece', f: (x) => ({ ...x, p: clip(x.p - 0.2) }) },
  { id: 'D3', name: 'Opposite errors by domain: market - 0.2, event + 0.2', ref: 'dce', f: (x) => ({ ...x, p: clip(x.p + (x.domain === 'market' ? -0.2 : x.domain === 'event' ? 0.2 : 0)) }) },
  { id: 'D4', name: 'Extremised: logit doubled', ref: 'ece', f: (x) => ({ ...x, p: expit(2 * logit(Math.min(0.995, Math.max(0.005, x.p)))) }) },
];
const distortion = DISTORTIONS.map((d) => {
  const res = {};
  for (const [k, scoreKey] of [['baseline confidence calibration', 'baselinecc'], ['baseline risk calibration', 'baselinerc'], ['revised confidence calibration', 'revisedcc'], ['revised risk calibration', 'revisedrc']]) {
    let agree = 0, refRose = 0, unchanged = 0;
    for (const [, f] of forecasters) {
      const g = f.map(d.f);
      const dRef = reference(g)[d.ref] - reference(f)[d.ref];
      const dScore = scores(g)[scoreKey] - scores(f)[scoreKey];
      if (dRef > 0) refRose++;
      if (dScore === 0) unchanged++;
      if (Math.sign(dScore) === -Math.sign(dRef) && dRef !== 0) agree++;
    }
    res[k] = { agreement: +(agree / forecasters.length).toFixed(3), unchanged: +(unchanged / forecasters.length).toFixed(3) };
  }
  return { id: d.id, name: d.name, reference: d.ref.toUpperCase(), forecasters: forecasters.length, results: res };
});

// 3. History length: score computed on random subsamples of n forecasts, correlated with the reference measure
//    computed on the forecaster's full history. Forecasters with at least 80 forecasts; 200 draws per n.
const long = forecasters.filter(([, f]) => f.length >= 80);
const fullEce = long.map(([, f]) => reference(f).ece), fullDce = long.map(([, f]) => reference(f).dce);
const lengthCurve = [10, 20, 40, 80].map((n) => {
  const rng = mulberry32(4242 + n), acc = { baselinecc: [], revisedcc: [], baselinerc: [], revisedrc: [] };
  for (let draw = 0; draw < 200; draw++) {
    const sub = long.map(([, f]) => { const a = [...f]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return scores(a.slice(0, n)); });
    acc.baselinecc.push(spearman(sub.map((s) => s.baselinecc), fullEce)); acc.revisedcc.push(spearman(sub.map((s) => s.revisedcc), fullEce));
    acc.baselinerc.push(spearman(sub.map((s) => s.baselinerc), fullDce)); acc.revisedrc.push(spearman(sub.map((s) => s.revisedrc), fullDce));
  }
  return { n, forecasters: long.length, ...Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +mean(v).toFixed(3)])) };
});

const summary = {
  forecasters: forecasters.length, forecasts: forecasters.reduce((a, [, f]) => a + f.length, 0),
  forecastsPerForecaster: { min: Math.min(...table.map((r) => r.n)), median: [...table.map((r) => r.n)].sort((a, b) => a - b)[Math.floor(table.length / 2)], max: Math.max(...table.map((r) => r.n)) },
  pooled: reference(forecasters.flatMap(([, f]) => f)),
  ranges: Object.fromEntries(['baselinecc', 'revisedcc', 'baselinerc', 'revisedrc', 'ece', 'dce', 'brier'].map((k) => [k, [Math.min(...col(k)), Math.max(...col(k))].map((x) => +x.toFixed(3))])),
};
writeResult('replay.json', { environment: environment(), source: 'ForecastBench superforecaster forecasts, question set 2024-07-21 (CC BY-SA 4.0)', minForecasts: MIN_FORECASTS, summary, correlations, distortion, lengthCurve, perForecaster: table });
console.log(JSON.stringify(summary, null, 1));
for (const c of correlations) console.log(`${c.score.padEnd(28)} vs ${c.reference.padEnd(28)} rho=${c.rho.toFixed(2)} [${c.ci95.map((x) => x.toFixed(2)).join(', ')}]`);
for (const d of distortion) console.log(d.id, d.name, JSON.stringify(d.results));
console.log(lengthCurve);
