# Baseline implementation

This folder holds the baseline implementation that the paper evaluates alongside the revised application in
`../app/`. Its server code (API routes, data model, scoring rules in `lib/analytics/index.ts`) is the code the paper
measures. The landing-page components (`components/Hero.tsx`, `components/LandingContent.tsx`) are the same as in
`../app/`; no experiment requests the landing page except as a warm-up.

The baseline targets Neon's serverless database driver. The evaluation kit runs it against a local PostgreSQL server
by substituting the seven-line node-postgres client in `../evaluation/baseline-rules/lib-db-index.local.ts`.

Known defects of the baseline (all reported in the paper, all fixed in `../app/`): prediction fields editable after
an outcome is recorded, outcomes datable before the decision was logged, a race that can store two outcomes for one
decision, unescaped user text in exported reports, one database query per decision in analytics and the dashboard,
a score snapshot on every analytics request, calibration scores that do not measure calibration, and dependencies
with known vulnerabilities. **Do not deploy it.**
