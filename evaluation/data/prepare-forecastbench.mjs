// Builds data/forecastbench-superforecasters.csv from the public ForecastBench datasets repository.
//
// Source: Forecasting Research Institute, ForecastBench datasets (Karger et al., ICLR 2025), CC BY-SA 4.0,
// https://github.com/forecastingresearch/forecastbench-datasets
// Input files: datasets/forecast_sets/2024-07-21/2024-07-21.ForecastBench.human_super_individual.json
//              datasets/resolution_sets/2024-07-21_resolution_set.json
// Output: one row per individual superforecaster forecast whose question resolved to 0 or 1, with the
// pseudonymous forecaster identifier as published, the stated probability and the outcome.
// Usage: node data/prepare-forecastbench.mjs /path/to/forecastbench-datasets
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: node data/prepare-forecastbench.mjs /path/to/forecastbench-datasets');
const forecasts = JSON.parse(fs.readFileSync(path.join(root, 'datasets/forecast_sets/2024-07-21/2024-07-21.ForecastBench.human_super_individual.json'), 'utf8')).forecasts;
const resolutions = JSON.parse(fs.readFileSync(path.join(root, 'datasets/resolution_sets/2024-07-21_resolution_set.json'), 'utf8')).resolutions;

const J = (x) => JSON.stringify(x ?? null);
const byKey = new Map();
for (const r of resolutions) {
  const k = `${J(r.id)}|${r.source}|${J(r.direction)}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(r);
}
const MARKETS = new Set(['manifold', 'metaculus', 'polymarket', 'infer']);
const ECONOMIC = new Set(['fred', 'dbnomics', 'yfinance']);
const domain = (s) => (MARKETS.has(s) ? 'market' : ECONOMIC.has(s) ? 'economic' : 'event');

const rows = [];
let noResolution = 0, unresolved = 0;
for (const f of forecasts) {
  const cands = byKey.get(`${J(f.id)}|${f.source}|${J(f.direction)}`) || [];
  // Dataset questions carry their own resolution date; market questions resolve once.
  const r = f.resolution_date ? cands.find((c) => c.resolution_date === f.resolution_date) : cands.find((c) => c.resolved);
  if (!r) { noResolution++; continue; } // horizon not reached, market unresolved, or question dropped
  if (!r.resolved || !(r.resolved_to === 0 || r.resolved_to === 1)) { unresolved++; continue; }
  if (typeof f.forecast !== 'number' || f.forecast < 0 || f.forecast > 1) { unresolved++; continue; }
  rows.push([f.user_id, typeof f.id === 'string' ? f.id : J(f.id), f.source, domain(f.source), r.resolution_date, f.forecast, r.resolved_to]);
}
const header = 'forecaster,question_id,source,domain,resolution_date,probability,outcome';
const csv = [header, ...rows.map((r) => r.map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(','))].join('\n') + '\n';
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'forecastbench-superforecasters.csv');
fs.writeFileSync(out, csv);
console.log(`${rows.length} forecasts written; ${noResolution} without a resolution (horizon not yet reached, market not yet resolved, or question dropped), ${unresolved} unresolved or non-binary -> ${out}`);
