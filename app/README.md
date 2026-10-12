# Digital Memory Vault

An open-source web application for logging personal decisions as predictions and scoring them against their
outcomes. For each decision you record, **before the result is known**, your confidence (1-10), emotional state,
risk level and expected outcome. Later you record a success rating and a reflection. The application then reports
four scores: decision accuracy, confidence calibration, risk calibration and emotional bias.

This folder is part of the paper artefact; the evaluation kit and the data are in `../evaluation/`.

> No real users took part in the evaluation. Scores were validated with metamorphic relations, synthetic users
> with known behaviour, and a replay of public forecasts by real forecasters (ForecastBench).

---

## Scores

All scores are on a 0-100 scale and are computed by a pure module, [`lib/analytics/scores.ts`](lib/analytics/scores.ts).

| Score | Rule |
|---|---|
| Decision accuracy | Mean over resolved decisions of 100 - 10 x \|confidence - success\|. |
| Confidence calibration | Decisions are grouped by stated confidence; the weighted mean of \|mean confidence - mean success\| across groups (in steps) is converted to 100 - 10 x error. |
| Risk calibration | The same error computed within each risk level (low, medium, high). |
| Emotional bias | 40 points for a non-calm state, plus 10 per warning word in the reflection (whole words and inflections, negated words ignored), capped at 100, averaged over all decisions. |

With fewer than 20 resolved decisions the calibration scores are shown as provisional: in simulation, 20 decisions
are needed before every two-step miscalibration is flagged with at least 80% sensitivity at 95% specificity.

## Tech stack

Next.js 16 (App Router), TypeScript, PostgreSQL through Drizzle ORM (Neon serverless driver or node-postgres),
custom JWT authentication (`jose`, `bcryptjs`), Zod validation, Recharts, Tailwind CSS, Three.js and GSAP on the
landing page.

## Getting started

Requirements: Node.js 22.18 or later and a PostgreSQL database (Neon, Supabase, a local server, or
`docker compose -f ../evaluation/docker-compose.yml up -d`).

```bash
cd app
npm ci
cat > .env.local <<'EOF'
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
JWT_SECRET=<a long random string>
EOF
npx drizzle-kit push
npm run dev            # or: npx next build && npx next start
```

`DATABASE_URL` on a `*.neon.tech` host uses Neon's serverless driver; any other host uses node-postgres.
Set `DB_DRIVER=neon` or `DB_DRIVER=pg` to override.

## Evaluation, data and citation

See the repository's top-level `README.md`.
