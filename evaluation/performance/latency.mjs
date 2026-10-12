// Response-time measurements against a running instance (10 to
// 1,000 decisions, with SQL statement counts when the app is connected through performance/pg-proxy.mjs).
// Usage: BASE_URL=... DATABASE_URL=<direct db url, for seeding> [PROXY_CONTROL=http://127.0.0.1:7001] LABEL=revised \
//        RESULTS_DIR=... node performance/latency.mjs
import pg from 'pg';
import { call, newUser, quantiles, writeResult, DATABASE_URL, LABEL, environment } from '../lib/common.mjs';

const REPS = Number(process.env.REPS || 30);
const SIZES = (process.env.SIZES || '10,50,100,250,500,1000').split(',').map(Number);
const PROXY = process.env.PROXY_CONTROL || null;
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

const decisionBody = { title: 'Perf decision', category: 'product', description: 'Latency measurement decision.', expectedOutcome: 'Measured response time.', confidenceLevel: 7, emotionalState: 'calm', riskLevel: 'medium', decisionDate: '2026-09-01' };
const outcomeBody = { actualOutcome: 'Outcome for latency test.', successRating: 6, lessonLearned: 'None, test.', reflection: 'Test reflection.' };
const out = { label: LABEL, environment: environment(), reps: REPS, endpoints: {}, analyticsByN: {}, dashboardByN: {}, statementsPerAnalyticsRequest: {}, statementsPerDashboardRequest: {} };

// Seed n resolved decisions for a user directly in the database (one statement per table).
export async function seed(userEmail, n) {
  const { rows: [{ id }] } = await pool.query('select id from users where email = $1', [userEmail]);
  await pool.query(`
    with d as (
      insert into decisions (user_id, title, category, description, expected_outcome, confidence_level, emotional_state, risk_level, decision_date, status)
      select $1, 'Seeded decision ' || i, (array['career','finance','health','product','personal'])[1 + i % 5]::category,
             'Seeded for latency test.', 'Seeded expected outcome.', 1 + (i * 7) % 10,
             (array['calm','stressed','excited','pressured','uncertain'])[1 + i % 5]::emotional_state,
             (array['low','medium','high'])[1 + i % 3]::risk_level, now() - ((i % 365) || ' days')::interval, 'outcome_recorded'
      from generate_series(0, $2 - 1) as i
      returning id, confidence_level)
    insert into outcomes (decision_id, actual_outcome, success_rating, lesson_learned, reflection)
    select id, 'Seeded outcome text', 1 + (confidence_level * 3) % 10, 'Seeded lesson', 'Seeded reflection, felt rushed' from d`, [id, n]);
  return id;
}
async function statementsFor(fn) {
  if (!PROXY) return null;
  await fetch(`${PROXY}/reset`, { method: 'POST' });
  await fn();
  await new Promise((r) => setTimeout(r, 50));
  return (await (await fetch(`${PROXY}/count`)).json()).statements;
}

for (let i = 0; i < 5; i++) await call('GET', '/');

const reg = [];
for (let i = 0; i < 20; i++) reg.push((await newUser('reg')).ms);
out.endpoints['Register'] = quantiles(reg);
const { email } = await newUser('login');
const login = [];
for (let i = 0; i < 20; i++) { const r = await call('POST', '/api/auth/login', { body: { email, password: 'EvalUser123' } }); if (r.status === 200) login.push(r.ms); }
out.endpoints['Log in'] = quantiles(login);

const { token } = await newUser('crud');
const create = [], ids = [];
for (let i = 0; i < REPS; i++) { const r = await call('POST', '/api/decisions', { token, body: decisionBody }); create.push(r.ms); ids.push(r.json.decision.id); }
out.endpoints['Log a decision'] = quantiles(create);
const outc = [];
for (const id of ids) outc.push((await call('POST', `/api/decisions/${id}/outcome`, { token, body: outcomeBody })).ms);
out.endpoints['Record an outcome'] = quantiles(outc);
const list = [], one = [], exp = [];
for (let i = 0; i < REPS; i++) list.push((await call('GET', '/api/decisions', { token })).ms);
for (let i = 0; i < REPS; i++) one.push((await call('GET', `/api/decisions/${ids[i]}`, { token })).ms);
for (let i = 0; i < REPS; i++) exp.push((await call('GET', `/api/export/${ids[i]}`, { token })).ms);
out.endpoints[`List decisions (${REPS} decisions)`] = quantiles(list);
out.endpoints['View one decision'] = quantiles(one);
out.endpoints['Export a report'] = quantiles(exp);

for (const n of SIZES) {
  const u = await newUser(`n${n}`);
  await seed(u.email, n);
  await call('GET', '/api/analytics', { token: u.token }); await call('GET', '/dashboard', { token: u.token });
  const a = [], dsh = [];
  for (let i = 0; i < REPS; i++) a.push((await call('GET', '/api/analytics', { token: u.token })).ms);
  for (let i = 0; i < REPS; i++) dsh.push((await call('GET', '/dashboard', { token: u.token })).ms);
  out.analyticsByN[n] = quantiles(a);
  out.dashboardByN[n] = quantiles(dsh);
  out.statementsPerAnalyticsRequest[n] = await statementsFor(() => call('GET', '/api/analytics', { token: u.token }));
  out.statementsPerDashboardRequest[n] = await statementsFor(() => call('GET', '/dashboard', { token: u.token }));
  const { rows: [{ c }] } = await pool.query('select count(*)::int as c from decision_metrics m join users u on u.id = m.user_id where u.email = $1', [u.email]);
  out.analyticsByN[n].snapshotRowsAfter = c;
  console.log(`n=${n} analytics ${out.analyticsByN[n].median} ms (p95 ${out.analyticsByN[n].p95}), dashboard ${out.dashboardByN[n].median} ms, statements ${out.statementsPerAnalyticsRequest[n]}, snapshots ${c}`);
}
await pool.end();
writeResult(`latency-${LABEL}.json`, out);
console.log(JSON.stringify(out.endpoints, null, 1));
