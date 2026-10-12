// Concurrent load: C clients repeatedly request GET /api/analytics for a user with N resolved decisions.
// Usage: BASE_URL=... DATABASE_URL=... C=10 DURATION=20 N=100 LABEL=revised RESULTS_DIR=... node performance/load.mjs
import { call, newUser, quantiles, writeResult, LABEL, BASE, environment } from '../lib/common.mjs';
import pg from 'pg';
import { DATABASE_URL } from '../lib/common.mjs';

const C = Number(process.env.C || 10), DURATION = Number(process.env.DURATION || 20) * 1000, N = Number(process.env.N || 100);
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
const u = await newUser(`load${N}`);
const { rows: [{ id }] } = await pool.query('select id from users where email = $1', [u.email]);
await pool.query(`
  with d as (
    insert into decisions (user_id, title, category, description, expected_outcome, confidence_level, emotional_state, risk_level, decision_date, status)
    select $1, 'Load decision ' || i, 'product', 'Seeded for load test.', 'Seeded expected outcome.', 1 + (i * 7) % 10, 'calm',
           (array['low','medium','high'])[1 + i % 3]::risk_level, now(), 'outcome_recorded' from generate_series(0, $2 - 1) as i
    returning id, confidence_level)
  insert into outcomes (decision_id, actual_outcome, success_rating, lesson_learned, reflection)
  select id, 'Seeded outcome text', 1 + (confidence_level * 3) % 10, 'Seeded lesson', 'Seeded reflection' from d`, [id, N]);
await pool.end();
for (let i = 0; i < 5; i++) await call('GET', '/api/analytics', { token: u.token });

const lat = []; let errors = 0;
const end = Date.now() + DURATION;
async function worker() {
  while (Date.now() < end) {
    const t0 = performance.now();
    const r = await fetch(BASE + '/api/analytics', { headers: { cookie: `auth_token=${u.token}` } });
    await r.arrayBuffer();
    if (r.status === 200) lat.push(performance.now() - t0); else errors++;
  }
}
await Promise.all(Array.from({ length: C }, worker));
const q = quantiles(lat);
const out = { label: LABEL, environment: environment(), concurrency: C, seconds: DURATION / 1000, decisions: N, requests: lat.length, errors, throughput: +(lat.length / (DURATION / 1000)).toFixed(1), median: q.median, p95: q.p95 };
writeResult(`load-${LABEL}-n${N}.json`, out);
console.log(JSON.stringify(out));
