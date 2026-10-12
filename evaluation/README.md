# Evaluation kit

Everything needed to reproduce the results of the paper. All scripts are plain Node.js (ES modules); the scoring
module `app/lib/analytics/scores.ts` is imported directly through Node's type stripping (Node.js 22.18 or later).

## One command

```bash
docker compose -f evaluation/docker-compose.yml up -d     # PostgreSQL 16 on localhost:5432
PGURL=postgres://postgres:postgres@localhost:5432 evaluation/run-all.sh
node evaluation/summarise.mjs                             # results/summary.json and results/numbers.tex
```

`run-all.sh` copies `baseline/` and `app/` into a temporary directory, installs each implementation's own locked
dependencies, creates two fresh databases, builds and starts four servers (each implementation directly and behind
the statement-counting proxy), and runs every experiment. With `taskset` available it pins the servers and
PostgreSQL's clients to CPU 0 and the load generators to CPU 1 (`PIN_CPUS=0` disables this). On the two-vCPU machine
used for the paper it takes about 30 minutes, of which mutation testing is about 12 (`SKIP_MUTATION=1` skips it).

## Experiments

| Folder / script | What it measures | Output in `results/` |
|---|---|---|
| `functional/functional.mjs` | 46 end-to-end tests over HTTP: 33 core tests (TC01-TC33) and 13 safeguard tests (TC34-TC46: prediction locking, outcome dating, concurrent outcomes, escaping of every exported field, cross-user edits, snapshot growth, and three scoring relations checked through the API) | `<impl>/functional-<impl>.json` |
| `scores/differential.mjs` | Enters the noisy-reporter simulation (4 profiles x 25 users x 40 decisions) and the ten-decision worked example through the API, and checks every returned score against the pure scoring functions of the same rules | `<impl>/differential-<impl>.json` |
| `performance/latency.mjs` | Median and 95th-percentile response times per endpoint and for analytics and the dashboard at 10-1,000 decisions; with the proxy, SQL statements per request | `<impl>/latency-<impl>.json`, `<impl>/latency-<impl>-proxied.json` |
| `performance/load.mjs` | Ten concurrent clients for 20 s at 100 and 500 decisions | `<impl>/load-<impl>-nN.json` |
| `performance/network.mjs` + `pg-proxy.mjs` | Analytics and dashboard latency with 0-20 ms emulated database round-trip time | `<impl>/network-<impl>-n100.json` |
| `scores/metamorphic.mjs` | Ten metamorphic relations checked on 1,000 generated histories each, for the baseline and revised rules | `offline/metamorphic.json` |
| `scores/power.mjs` | Detection power (AUC; sensitivity at 95% specificity) of each score against six miscalibration profiles at 5-120 decisions, 1,000 users per cell | `offline/power.json` |
| `scores/replay.mjs` | 4,793 resolved forecasts by 39 superforecasters (ForecastBench) scored by both sets of rules and compared with standard calibration measures | `offline/replay.json` |
| `tests/*.test.mjs` | Worked-example, unit (example-based), metamorphic and property-based tests of the scoring module (`node --test`) | - |
| `mutation/stryker.*.json` | Mutation testing of `app/lib/analytics/scores.ts` with five cumulative test sets | `offline/mutation-*.json` |
| `run-all.sh` (end) | `npm audit --omit=dev` for both implementations | `<impl>/npm-audit-<impl>.json` |

`<impl>` is `baseline` or `revised`. `baseline-rules/baseline-scores.ts` holds the baseline scoring rules as pure
functions; the differential check confirms that they reproduce the running baseline exactly.
`baseline-rules/lib-db-index.local.ts` is the node-postgres client substituted for Neon's driver when the baseline
runs locally.

## Data

`data/forecastbench-superforecasters.csv` (CC BY-SA 4.0) is derived from the public ForecastBench datasets by
`data/prepare-forecastbench.mjs`: individual superforecaster forecasts on the 2024-07-21 question set whose
questions had resolved to 0 or 1 (4,797 forecasts; the 4,793 from the 39 forecasters with at least 20 resolved
forecasts are analysed). Forecaster identifiers are the pseudonyms published by ForecastBench.

## Notes

- The Neon serverless driver cannot be reached from an isolated machine; both implementations use node-postgres
  here. `performance/network.mjs` emulates network round trips instead.
- All synthetic data come from seeded generators (`scores/model.mjs`), so offline results are bit-for-bit
  reproducible. Timing results vary with hardware.
