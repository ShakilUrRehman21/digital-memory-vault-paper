# Digital Memory Vault: paper artefact

Artefact for the paper **"Testing What a Score Measures: Validating and Repairing the Calibration Scores of a
Personal Decision Analytics System"** (submitted to *Software Testing, Verification and Reliability*).

Digital Memory Vault is an open-source web application that records personal decisions as predictions (stated
confidence, emotional state, risk level, expected outcome) and scores them against their outcomes. The paper shows
how such scoring code can be tested without human participants, using metamorphic relations, simulation with known
ground truth and a replay of public real-world forecasts, and applies the approach to the application.

## Contents

| Folder | What it is |
|---|---|
| `app/` | The application (revised implementation): Next.js, TypeScript, PostgreSQL. Scoring rules in `app/lib/analytics/scores.ts`. |
| `baseline/` | The baseline implementation the paper compares against (see `baseline/BASELINE.md`). |
| `evaluation/` | The evaluation kit: functional, safeguard, performance, metamorphic, property-based, mutation and real-data experiments, the raw results of the reported run, and the dataset. |
| `paper/` | LaTeX source of the paper, figure sources, and the scripts that build tables and figures from `evaluation/results/`. |

## Reproduce every result

Requirements: Node.js 22.18 or later, a PostgreSQL 16 server and the `psql` client (Docker can provide PostgreSQL).

```bash
docker compose -f evaluation/docker-compose.yml up -d
PGURL=postgres://postgres:postgres@localhost:5432 evaluation/run-all.sh   # about 30 minutes
node evaluation/summarise.mjs                                             # writes results/summary.json and numbers.tex
```

`run-all.sh` builds `baseline/` and `app/` into a temporary directory, creates fresh databases, starts both
implementations, and runs every experiment. Then rebuild the paper:

```bash
cd paper
cp ../evaluation/results/numbers.tex .
python3 make_assets.py && python3 make_gtoc.py      # tables and figures from the results (needs matplotlib)
pdflatex main.tex && pdflatex main.tex && pdflatex main.tex
```

Every number in the paper is a LaTeX macro defined in `evaluation/results/numbers.tex`, which `summarise.mjs`
generates from the raw results.

## Running the application

```bash
cd app
npm ci
printf 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres\nJWT_SECRET=%s\n' "$(openssl rand -hex 32)" > .env.local
npx drizzle-kit push
npm run dev
```

A `DATABASE_URL` on a `*.neon.tech` host uses Neon's serverless driver; any other host uses node-postgres.

## Data

`evaluation/data/forecastbench-superforecasters.csv` is derived from the ForecastBench datasets of the Forecasting
Research Institute (Karger et al., ICLR 2025) and is distributed under **CC BY-SA 4.0**
(`evaluation/data/FORECASTBENCH-LICENSE.txt`). `evaluation/data/prepare-forecastbench.mjs` derives it from
<https://github.com/forecastingresearch/forecastbench-datasets>.

## Licence

Code: MIT (`LICENSE`). Derived ForecastBench data: CC BY-SA 4.0.

## Citation

See `CITATION.cff`.
