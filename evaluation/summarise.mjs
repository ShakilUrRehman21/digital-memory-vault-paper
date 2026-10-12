// Summarises evaluation/results into results/summary.json and results/numbers.tex.
// numbers.tex defines one LaTeX macro per reported value, so the manuscript can cite results without retyping them.
// Usage: node evaluation/summarise.mjs
import fs from 'node:fs';
import path from 'node:path';

const R = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
const read = (...p) => JSON.parse(fs.readFileSync(path.join(R, ...p), 'utf8'));
const macros = [];
const fmt = (x, d = 1) => (typeof x === 'number' ? x.toFixed(d) : String(x));
// Macro names may contain letters only: digits are spelled out.
const DIG = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const name = (s) => s.replace(/[0-9]/g, (d) => DIG[d]).replace(/[^A-Za-z]/g, '');
const def = (n, v) => macros.push(`\\newcommand{\\${name(n)}}{${v}}`);
const pct = (a, b) => (100 * (a - b)) / a;

const S = {};
for (const v of ['baseline', 'revised']) {
  const f = read(v, `functional-${v}.json`);
  const lat = read(v, `latency-${v}.json`), prox = read(v, `latency-${v}-proxied.json`);
  const load = Object.fromEntries([100, 500].map((n) => [n, read(v, `load-${v}-n${n}.json`)]));
  const net = read(v, `network-${v}-n100.json`);
  const diff = read(v, `differential-${v}.json`);
  S[v] = { functional: f.summary, byArea: {}, latency: lat, statements: prox.statementsPerAnalyticsRequest, dashStatements: prox.statementsPerDashboardRequest, load, net, diff };
  for (const t of f.results) {
    S[v].byArea[t.area] ??= { tests: 0, passed: 0 };
    S[v].byArea[t.area].tests++; if (t.pass) S[v].byArea[t.area].passed++;
  }
  const V = v === 'baseline' ? 'Base' : 'Rev';
  def(`${V}FuncCorePassed`, f.summary.core.passed); def(`${V}FuncSafePassed`, f.summary.safeguard.passed); def(`${V}FuncAllPassed`, f.summary.all.passed);
  for (const [k, x] of Object.entries(lat.endpoints)) { def(`${V}Lat${k}Median`, fmt(x.median)); def(`${V}Lat${k}Pninetyfive`, fmt(x.p95)); }
  for (const [n, x] of Object.entries(lat.analyticsByN)) { def(`${V}Analytics${n}Median`, fmt(x.median)); def(`${V}Analytics${n}Pninetyfive`, fmt(x.p95)); def(`${V}Snapshots${n}`, x.snapshotRowsAfter); }
  for (const [n, x] of Object.entries(lat.dashboardByN)) { def(`${V}Dashboard${n}Median`, fmt(x.median)); def(`${V}Dashboard${n}Pninetyfive`, fmt(x.p95)); }
  for (const [n, x] of Object.entries(prox.statementsPerAnalyticsRequest)) def(`${V}Statements${n}`, x);
  for (const [n, x] of Object.entries(prox.statementsPerDashboardRequest)) def(`${V}DashStatements${n}`, x);
  for (const [n, x] of Object.entries(load)) { def(`${V}Load${n}Requests`, x.requests.toLocaleString('en-US')); def(`${V}Load${n}Throughput`, fmt(x.throughput)); def(`${V}Load${n}Median`, fmt(x.median)); def(`${V}Load${n}Pninetyfive`, fmt(x.p95)); def(`${V}Load${n}Errors`, x.errors); }
  for (const [r, x] of Object.entries(net.byRtt)) { def(`${V}Rtt${r}Analytics`, fmt(x.analytics.median)); def(`${V}Rtt${r}Dashboard`, fmt(x.dashboard.median)); }
  def(`${V}DiffMismatches`, diff.mismatchedValues); def(`${V}DiffCompared`, diff.comparedValues);
  for (const [p, s] of Object.entries(diff.summary)) for (const [k, x] of Object.entries(s)) {
    def(`${V}Sim${p}${k}`, fmt(x.mean)); def(`${V}Sim${p}${k}SD`, fmt(x.sd));
  }
  for (const [k, x] of Object.entries(diff.workedExample.api)) if (typeof x === 'number') def(`${V}Worked${k}`, fmt(x, Number.isInteger(x) ? 0 : 1));
}
// Derived comparisons.
for (const n of ['500', '1000']) {
  def(`AnalyticsReduction${n}`, fmt(pct(S.baseline.latency.analyticsByN[n].median, S.revised.latency.analyticsByN[n].median), 0));
  def(`DashboardReduction${n}`, fmt(pct(S.baseline.latency.dashboardByN[n].median, S.revised.latency.dashboardByN[n].median), 0));
}
for (const n of [100, 500]) def(`LoadGain${n}`, fmt(S.revised.load[n].throughput / S.baseline.load[n].throughput, 1));
const rtts = Object.keys(S.baseline.net.byRtt).map(Number);
const slope = (v) => { const a = S[v].net.byRtt; const lo = Math.min(...rtts), hi = Math.max(...rtts); return (a[hi].analytics.median - a[lo].analytics.median) / (hi - lo); };
// Values quoted in the text: proxy offset at zero delay (100 decisions), password endpoints and other endpoints.
const offsets = ['baseline', 'revised'].map((v) => S[v].net.byRtt['0'].analytics.median - S[v].latency.analyticsByN['100'].median);
def('ProxyOffsetMin', fmt(Math.min(...offsets), 0)); def('ProxyOffsetMax', fmt(Math.max(...offsets), 0));
const pw = ['baseline', 'revised'].flatMap((v) => ['Register', 'Log in'].map((k) => S[v].latency.endpoints[k].median / 1000));
def('PasswordMin', fmt(Math.min(...pw), 2)); def('PasswordMax', fmt(Math.max(...pw), 2));
const others = ['baseline', 'revised'].flatMap((v) => Object.entries(S[v].latency.endpoints).filter(([k]) => !['Register', 'Log in'].includes(k)).map(([, x]) => x.median));
def('OtherEndpointMax', fmt(Math.ceil(Math.max(...others)), 0));
def('BaseRttSlope', fmt(slope('baseline'))); def('RevRttSlope', fmt(slope('revised')));

// Offline experiments.
const mr = read('offline', 'metamorphic.json');
S.metamorphic = mr.results;
for (const r of mr.results) def(`MR${r.id}${r.version}${r.score}`, fmt(100 * r.rate, 1));
def('MRSources', mr.sources.toLocaleString('en-US'));
const pwr = read('offline', 'power.json');
S.power = { minimumHistory: pwr.minimumHistory, repetitions: pwr.repetitions };
def('PowerReps', pwr.repetitions.toLocaleString('en-US')); def('MinimumHistory', pwr.minimumHistory.overall);
const pick = (n, prof, score, k = 'auc') => pwr.rows.find((r) => r.n === n && r.profile === prof && r.score === score)[k];
for (const n of pwr.lengths) for (const [prof, tag] of [['Overconfident (+1)', 'OverOne'], ['Overconfident (+2)', 'OverTwo'], ['Underconfident (-2)', 'UnderTwo'], ['Inconsistent (+/-2)', 'IncTwo'], ['Inconsistent (+/-3)', 'IncThree'], ['Noisy (SD 2)', 'NoisyTwo']]) {
  for (const [score, st] of [['baseline confidence calibration', 'BaseCC'], ['baseline risk calibration', 'BaseRC'], ['baseline decision accuracy', 'BaseDA'], ['revised confidence calibration', 'RevCC'], ['revised risk calibration', 'RevRC']]) {
    def(`Pow${tag}${st}N${n}Auc`, fmt(pick(n, prof, score), 2));
    def(`Pow${tag}${st}N${n}Sens`, fmt(100 * pick(n, prof, score, 'sensitivity95'), 0));
  }
}
const rp = read('offline', 'replay.json');
S.replay = { summary: rp.summary, correlations: rp.correlations, distortion: rp.distortion, lengthCurve: rp.lengthCurve };
def('ReplayForecasters', rp.summary.forecasters); def('ReplayForecasts', rp.summary.forecasts.toLocaleString('en-US'));
def('ReplayMinPer', rp.summary.forecastsPerForecaster.min); def('ReplayMedianPer', rp.summary.forecastsPerForecaster.median); def('ReplayMaxPer', rp.summary.forecastsPerForecaster.max);
def('ReplayBaseRate', fmt(100 * rp.summary.pooled.baseRate, 1)); def('ReplayBrier', fmt(rp.summary.pooled.brier, 3)); def('ReplayEce', fmt(rp.summary.pooled.ece, 3));
rp.correlations.forEach((c, i) => { def(`Rho${'ABCDEFGHI'[i]}`, fmt(c.rho, 2).replace('-', '$-$')); def(`Rho${'ABCDEFGHI'[i]}Lo`, fmt(c.ci95[0], 2).replace('-', '$-$')); def(`Rho${'ABCDEFGHI'[i]}Hi`, fmt(c.ci95[1], 2).replace('-', '$-$')); });
for (const d of rp.distortion) for (const [k, x] of Object.entries(d.results)) {
  const st = k.replace('baseline confidence calibration', 'BaseCC').replace('baseline risk calibration', 'BaseRC').replace('revised confidence calibration', 'RevCC').replace('revised risk calibration', 'RevRC');
  def(`Dist${d.id}${st}`, fmt(100 * x.agreement, 0)); def(`Dist${d.id}${st}Unchanged`, fmt(100 * x.unchanged, 0));
}
for (const l of rp.lengthCurve) for (const k of ['baselinecc', 'revisedcc', 'baselinerc', 'revisedrc']) def(`Len${l.n}${k}`, fmt(l[k], 2).replace('-', '$-$'));
def('LenForecasters', rp.lengthCurve[0].forecasters);
S.mutation = {};
for (const c of ['1-worked', '2-metamorphic', '3-property', '4-full', '5-examples-only']) {
  const f = path.join(R, 'offline', `mutation-${c}.json`);
  if (!fs.existsSync(f)) continue;
  const d = read('offline', `mutation-${c}.json`);
  const ms = Object.values(d.files).flatMap((x) => x.mutants);
  const killed = ms.filter((m) => m.status === 'Killed' || m.status === 'Timeout').length;
  S.mutation[c] = { mutants: ms.length, killed, score: (100 * killed) / ms.length, survived: ms.filter((m) => m.status === 'Survived').map((m) => `${m.location.start.line}:${m.mutatorName}`) };
  const t = c.split('-')[1].replace('only', 'Only');
  def(`Mut${t}Killed`, killed); def(`Mut${t}Score`, fmt(S.mutation[c].score, 1));
}
const totals = [...new Set(Object.values(S.mutation).map((x) => x.mutants))];
if (totals.length) def('MutTotal', totals.join('/'));
fs.writeFileSync(path.join(R, 'summary.json'), JSON.stringify(S, null, 2));
fs.writeFileSync(path.join(R, 'numbers.tex'), `% Generated by evaluation/summarise.mjs from evaluation/results. Do not edit by hand.\n${macros.join('\n')}\n`);
console.log(`${macros.length} macros written to ${path.join(R, 'numbers.tex')}`);
