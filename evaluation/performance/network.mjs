// Analytics latency as a function of the database round-trip time.
// The application instance under test must connect to PostgreSQL through performance/pg-proxy.mjs; this script
// changes the proxy's delay between runs. RTT = 2 x one-way delay.
// Usage: BASE_URL=... DATABASE_URL=<direct> PROXY_CONTROL=http://127.0.0.1:7001 N=100 LABEL=revised node performance/network.mjs
import pg from 'pg';
import { call, newUser, quantiles, writeResult, DATABASE_URL, LABEL, environment } from '../lib/common.mjs';

const PROXY = process.env.PROXY_CONTROL || 'http://127.0.0.1:7001';
const REPS = Number(process.env.REPS || 20);
const N = Number(process.env.N || 100);
const RTTS = (process.env.RTTS || '0,2,5,10,20').split(',').map(Number);
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
const u = await newUser(`net${N}`);
const { rows: [{ id }] } = await pool.query('select id from users where email = $1', [u.email]);
await pool.query(`
  with d as (
    insert into decisions (user_id, title, category, description, expected_outcome, confidence_level, emotional_state, risk_level, decision_date, status)
    select $1, 'Net decision ' || i, 'product', 'Seeded for network test.', 'Seeded expected outcome.', 1 + (i * 7) % 10, 'calm',
           (array['low','medium','high'])[1 + i % 3]::risk_level, now(), 'outcome_recorded' from generate_series(0, $2 - 1) as i
    returning id, confidence_level)
  insert into outcomes (decision_id, actual_outcome, success_rating, lesson_learned, reflection)
  select id, 'Seeded outcome text', 1 + (confidence_level * 3) % 10, 'Seeded lesson', 'Seeded reflection' from d`, [id, N]);
await pool.end();

const out = { label: LABEL, environment: environment(), decisions: N, reps: REPS, byRtt: {} };
for (const rtt of RTTS) {
  await fetch(`${PROXY}/delay/${rtt / 2}`, { method: 'POST' });
  for (let i = 0; i < 3; i++) { await call('GET', '/api/analytics', { token: u.token }); await call('GET', '/dashboard', { token: u.token }); }
  const a = [], d = [];
  for (let i = 0; i < REPS; i++) a.push((await call('GET', '/api/analytics', { token: u.token })).ms);
  for (let i = 0; i < REPS; i++) d.push((await call('GET', '/dashboard', { token: u.token })).ms);
  out.byRtt[rtt] = { analytics: quantiles(a), dashboard: quantiles(d) };
  console.log(`RTT ${rtt} ms: analytics median ${out.byRtt[rtt].analytics.median} ms, dashboard ${out.byRtt[rtt].dashboard.median} ms`);
}
await fetch(`${PROXY}/delay/0`, { method: 'POST' });
writeResult(`network-${LABEL}-n${N}.json`, out);
