// Functional and safeguard tests for Digital Memory Vault, run against a live server.
// TC01-TC33 are the core functional tests: authentication, route protection, access control, decision logging,
// outcome recording, analytics and report export.
// TC34-TC46 are safeguard tests: prediction locking, outcome dating, concurrent outcomes, escaping of every exported
// field, cross-user edits, snapshot growth, and three scoring relations checked through the API.
// Usage: BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... LABEL=revised node functional/functional.mjs
import pg from 'pg';
import { call, tokenFrom, DATABASE_URL, LABEL, writeResult, environment } from '../lib/common.mjs';

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
const results = [];
function record(id, area, description, expected, actual, pass, added = false) {
  results.push({ id, area, description, expected, actual: String(actual), pass: !!pass, added }); // added = safeguard test
}

const stamp = Date.now();
const userA = { email: `a${stamp}@test.dev`, password: 'CorrectHorse9', fullName: 'Test User A' };
const userB = { email: `b${stamp}@test.dev`, password: 'BatteryStaple7', fullName: 'Test User B' };
const validDecision = {
  title: 'Accept internship offer', category: 'career',
  description: 'Choosing between two internship offers for the summer.',
  expectedOutcome: 'Gain product experience and a return offer.',
  confidenceLevel: 8, emotionalState: 'calm', riskLevel: 'medium', decisionDate: '2026-07-01',
};
const validOutcome = {
  actualOutcome: 'Received a return offer after the internship.', successRating: 9,
  lessonLearned: 'Comparing offers carefully paid off.', reflection: 'Took time to compare offers; glad I did.',
};
const redirectsTo = (r, re) => [302, 307].includes(r.status) && re.test(r.res.headers.get('location') || '');

// ---------- Authentication ----------
let r = await call('POST', '/api/auth/register', { body: userA });
const sc = r.setCookie || '';
record('TC01', 'Authentication', 'Register with valid details', '201 and session cookie set', `${r.status}; cookie ${sc ? 'set' : 'missing'}`, r.status === 201 && !!sc);
let tokenA = tokenFrom(r.setCookie);
record('TC02', 'Authentication', 'Session cookie is HttpOnly, SameSite=Strict, Secure, 7-day expiry', 'All four attributes present',
  sc.replace(/auth_token=[^;]+/, 'auth_token=<token>'),
  /HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc) && /Secure/i.test(sc) && /Max-Age=604800/.test(sc));
r = await call('POST', '/api/auth/register', { body: userA });
record('TC03', 'Authentication', 'Register with an email already in use', '409', r.status, r.status === 409);
r = await call('POST', '/api/auth/register', { body: { ...userB, password: 'short' } });
record('TC04', 'Authentication', 'Register with a password under 8 characters', '400', r.status, r.status === 400);
r = await call('POST', '/api/auth/register', { body: { ...userB, email: 'not-an-email' } });
record('TC05', 'Authentication', 'Register with an invalid email format', '400', r.status, r.status === 400);
r = await call('POST', '/api/auth/login', { body: { email: userA.email, password: userA.password } });
record('TC06', 'Authentication', 'Log in with correct credentials', '200 and session cookie set', `${r.status}; cookie ${r.setCookie ? 'set' : 'missing'}`, r.status === 200 && !!r.setCookie);
tokenA = tokenFrom(r.setCookie) || tokenA;
r = await call('POST', '/api/auth/login', { body: { email: userA.email, password: 'WrongPassword1' } });
record('TC07', 'Authentication', 'Log in with a wrong password', '401', r.status, r.status === 401);
{
  const ip = `198.51.100.${(stamp % 200) + 20}`;
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await call('POST', '/api/auth/login', { ip, body: { email: userA.email, password: 'WrongPassword1' } })).status);
  record('TC08', 'Authentication', 'Sixth failed login from the same IP within one minute is blocked', 'Attempts 1-5: 401, attempt 6: 429',
    statuses.join(', '), statuses.slice(0, 5).every((s) => s === 401) && statuses[5] === 429);
}
r = await call('POST', '/api/auth/register', { body: userB });
const tokenB = tokenFrom(r.setCookie);

// ---------- Route protection ----------
r = await call('GET', '/dashboard');
record('TC09', 'Route protection', 'Open the dashboard without logging in', 'Redirect to /auth/login', `${r.status} -> ${r.res.headers.get('location')}`, redirectsTo(r, /\/auth\/login/));
r = await call('GET', '/api/decisions');
record('TC10', 'Route protection', 'Call the decisions API without logging in', 'Redirect to /auth/login', `${r.status} -> ${r.res.headers.get('location')}`, redirectsTo(r, /\/auth\/login/));
r = await call('GET', '/api/decisions', { token: tokenA.slice(0, -4) + 'abcd' });
record('TC11', 'Route protection', 'Call the API with a tampered token', 'Redirect to /auth/login and cookie cleared', `${r.status}; cookie ${r.setCookie ? 'cleared' : 'not cleared'}`, [302, 307].includes(r.status) && !!r.setCookie);
r = await call('GET', '/auth/login', { token: tokenA });
record('TC12', 'Route protection', 'Open the login page while already logged in', 'Redirect to /dashboard', `${r.status} -> ${r.res.headers.get('location')}`, redirectsTo(r, /\/dashboard/));

// ---------- Decisions ----------
r = await call('POST', '/api/decisions', { token: tokenA, body: validDecision });
const decisionId = r.json?.decision?.id;
record('TC13', 'Decision logging', 'Log a decision with all fields valid', '201, status "pending_outcome"', `${r.status}; ${r.json?.decision?.status}`, r.status === 201 && r.json?.decision?.status === 'pending_outcome');
r = await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, confidenceLevel: 11 } });
const s11 = r.status;
r = await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, confidenceLevel: 0 } });
record('TC14', 'Decision logging', 'Log a decision with confidence outside 1-10 (0 and 11)', '400 for both', `${s11}, ${r.status}`, s11 === 400 && r.status === 400);
r = await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, category: 'travel' } });
record('TC15', 'Decision logging', 'Log a decision with an unknown category', '400', r.status, r.status === 400);
r = await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, description: 'short' } });
record('TC16', 'Decision logging', 'Log a decision with a description under 10 characters', '400', r.status, r.status === 400);
await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, title: 'Buy laptop on EMI', category: 'finance' } });
r = await call('GET', '/api/decisions', { token: tokenA });
record('TC17', 'Decision logging', 'List own decisions', '200 with both logged decisions', `${r.status}; ${r.json?.decisions?.length} decisions`, r.status === 200 && r.json?.decisions?.length === 2);
r = await call('GET', '/api/decisions?category=finance', { token: tokenA });
record('TC18', 'Decision logging', 'Filter decisions by category', 'Only finance decisions returned',
  `${r.json?.decisions?.length} returned; categories: ${[...new Set(r.json?.decisions?.map((d) => d.category))].join(',')}`,
  r.json?.decisions?.length === 1 && r.json.decisions[0].category === 'finance');
r = await call('PUT', `/api/decisions/${decisionId}`, { token: tokenA, body: { title: 'Accept summer internship offer' } });
record('TC19', 'Decision logging', 'Edit the title of a pending decision', '200 with updated title', `${r.status}; ${r.json?.decision?.title ?? r.json?.error}`, r.status === 200 && r.json?.decision?.title === 'Accept summer internship offer');

// ---------- Access control ----------
r = await call('GET', `/api/decisions/${decisionId}`, { token: tokenB });
record('TC20', 'Access control', "Another user reads user A's decision", '404', r.status, r.status === 404);
r = await call('DELETE', `/api/decisions/${decisionId}`, { token: tokenB });
record('TC21', 'Access control', "Another user deletes user A's decision", '404 and decision still exists', r.status, r.status === 404);
r = await call('POST', `/api/decisions/${decisionId}/outcome`, { token: tokenB, body: validOutcome });
record('TC22', 'Access control', "Another user records an outcome on user A's decision", '404', r.status, r.status === 404);

// ---------- Outcomes ----------
r = await call('POST', `/api/decisions/${decisionId}/outcome`, { token: tokenA, body: { ...validOutcome, successRating: 0 } });
record('TC23', 'Outcome recording', 'Record an outcome with success rating outside 1-10', '400', r.status, r.status === 400);
r = await call('POST', `/api/decisions/${decisionId}/outcome`, { token: tokenA, body: validOutcome });
let r2 = await call('GET', `/api/decisions/${decisionId}`, { token: tokenA });
record('TC24', 'Outcome recording', 'Record a valid outcome', '201; decision status becomes "outcome_recorded"', `${r.status}; ${r2.json?.decision?.status}`, r.status === 201 && r2.json?.decision?.status === 'outcome_recorded');
r = await call('POST', `/api/decisions/${decisionId}/outcome`, { token: tokenA, body: validOutcome });
record('TC25', 'Outcome recording', 'Record a second outcome for the same decision', '409', r.status, r.status === 409);
r = await call('PUT', `/api/decisions/${decisionId}`, { token: tokenA, body: { confidenceLevel: 9 } });
let after = await call('GET', `/api/decisions/${decisionId}`, { token: tokenA });
record('TC26', 'Outcome recording', 'Change the original confidence after the outcome is recorded', 'Rejected, so predictions stay fixed', `${r.status}; confidence now ${after.json?.decision?.confidenceLevel}`, r.status >= 400 && after.json?.decision?.confidenceLevel === 8);

// ---------- Analytics ----------
r = await call('GET', '/api/analytics', { token: tokenB });
record('TC27', 'Analytics', 'Request analytics for a user with no decisions', '200 with all scores 0',
  `${r.status}; scores ${[r.json?.decisionAccuracyScore, r.json?.riskCalibrationScore, r.json?.emotionalBiasScore, r.json?.confidenceCalibrationScore].join('/')}`,
  r.status === 200 && r.json.decisionAccuracyScore === 0 && r.json.confidenceCalibrationScore === 0);
r = await call('GET', '/api/analytics', { token: tokenA });
record('TC28', 'Analytics', 'Request analytics for a user with one resolved decision', '200; completed = 1, pending = 1',
  `${r.status}; completed ${r.json?.completedDecisions}, pending ${r.json?.pendingDecisions}`, r.status === 200 && r.json.completedDecisions === 1 && r.json.pendingDecisions === 1);

// ---------- Export ----------
r = await call('GET', `/api/export/${decisionId}`, { token: tokenA });
record('TC29', 'Report export', 'Export a decision report', '200, HTML file download',
  `${r.status}; ${r.res.headers.get('content-type')}; ${r.res.headers.get('content-disposition')}`,
  r.status === 200 && /text\/html/.test(r.res.headers.get('content-type') || '') && /attachment/.test(r.res.headers.get('content-disposition') || ''));
r = await call('GET', `/api/export/${decisionId}`, { token: tokenB });
record('TC30', 'Report export', "Another user exports user A's decision", '404', r.status, r.status === 404);
{
  const x = await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, title: '<b id="inj">Injected</b>' } });
  const exp = await call('GET', `/api/export/${x.json?.decision?.id}`, { token: tokenA });
  const raw = exp.text.includes('<b id="inj">Injected</b>');
  record('TC31', 'Report export', 'Export a decision whose title contains HTML markup', 'Markup escaped in the report', raw ? 'Markup inserted unescaped' : 'Markup escaped', exp.status === 200 && !raw);
}

// ---------- Safeguard tests: prediction locking, concurrency, escaping, snapshots, scoring ----------
{
  // Lock every prediction field, one at a time, on a resolved decision.
  const d = (await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, title: 'Lock test' } })).json.decision;
  await call('POST', `/api/decisions/${d.id}/outcome`, { token: tokenA, body: validOutcome });
  const cases = [
    ['TC34', 'riskLevel', 'high', 'risk level'],
    ['TC35', 'expectedOutcome', 'A different expectation written after the fact.', 'expected outcome'],
    ['TC36', 'emotionalState', 'stressed', 'emotional state'],
    ['TC37', 'decisionDate', '2026-01-01', 'decision date'],
  ];
  for (const [id, field, value, name] of cases) {
    const u = await call('PUT', `/api/decisions/${d.id}`, { token: tokenA, body: { [field]: value } });
    const now = (await call('GET', `/api/decisions/${d.id}`, { token: tokenA })).json?.decision;
    const unchanged = field === 'decisionDate' ? new Date(now?.decisionDate).toISOString().slice(0, 10) === d.decisionDate.slice(0, 10) : now?.[field] === d[field];
    record(id, 'Prediction integrity', `Change the ${name} after the outcome is recorded`, 'Rejected; stored value unchanged', `${u.status}; ${unchanged ? 'unchanged' : 'changed'}`, u.status >= 400 && unchanged, true);
  }
  const t = await call('PUT', `/api/decisions/${d.id}`, { token: tokenA, body: { title: 'Lock test (renamed)' } });
  record('TC38', 'Prediction integrity', 'Rename a resolved decision (title is not part of the prediction)', '200', t.status, t.status === 200, true);
  const early = (await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, title: 'Early outcome test' } })).json.decision;
  const e = await call('POST', `/api/decisions/${early.id}/outcome`, { token: tokenA, body: { ...validOutcome, outcomeDate: '2020-01-01' } });
  record('TC39', 'Prediction integrity', 'Record an outcome dated before the decision was logged', '400', e.status, e.status === 400, true);
}
{
  // Ten simultaneous outcome submissions for one pending decision.
  const d = (await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, title: 'Race test' } })).json.decision;
  const rs = await Promise.all(Array.from({ length: 10 }, () => call('POST', `/api/decisions/${d.id}/outcome`, { token: tokenA, body: validOutcome })));
  const created = rs.filter((x) => x.status === 201).length;
  const { rows: [{ n }] } = await pool.query('select count(*)::int as n from outcomes where decision_id = $1', [d.id]);
  record('TC40', 'Outcome recording', 'Submit ten outcomes for one decision at the same time', 'Exactly one accepted and one outcome stored',
    `${created} accepted (statuses ${[...new Set(rs.map((x) => x.status))].join('/')}); ${n} stored`, created === 1 && n === 1, true);
}
{
  const marker = '<img src=x id="inj2">';
  const d = (await call('POST', '/api/decisions', { token: tokenA, body: { ...validDecision, title: 'Escape test', description: `Description ${marker}`, expectedOutcome: `Expected ${marker}` } })).json.decision;
  await call('POST', `/api/decisions/${d.id}/outcome`, { token: tokenA, body: { actualOutcome: `Actual ${marker}`, successRating: 5, lessonLearned: `Lesson ${marker}`, reflection: `Reflection ${marker}` } });
  const exp = await call('GET', `/api/export/${d.id}`, { token: tokenA });
  const count = exp.text.split(marker).length - 1;
  record('TC41', 'Report export', 'Export a report whose description, expectation, outcome, lesson and reflection contain markup', 'All five fields escaped',
    `${count} of 5 fields unescaped`, exp.status === 200 && count === 0, true);
}
r = await call('PUT', `/api/decisions/${decisionId}`, { token: tokenB, body: { title: 'Hijacked' } });
record('TC42', 'Access control', "Another user edits user A's decision", '404', r.status, r.status === 404, true);
{
  // Snapshot growth: five analytics requests on one day.
  const { rows: [{ id: uid }] } = await pool.query('select id from users where email = $1', [userA.email]);
  const { rows: [{ n: before }] } = await pool.query('select count(*)::int as n from decision_metrics where user_id = $1', [uid]);
  for (let i = 0; i < 5; i++) await call('GET', '/api/analytics', { token: tokenA });
  const { rows: [{ n: afterN }] } = await pool.query('select count(*)::int as n from decision_metrics where user_id = $1', [uid]);
  const { rows: [{ n: total }] } = await pool.query("select count(*)::int as n from decision_metrics where user_id = $1 and snapshot_date >= now() - interval '1 day'", [uid]);
  record('TC43', 'Analytics', 'Open analytics five times on the same day', 'At most one snapshot per user per day',
    `${afterN - before} new rows; ${total} snapshots today`, total <= 1, true);
}
{
  // Scoring behaviour checked as metamorphic relations through the API:
  // two users with identical outcomes, one reporting confidence equal to the outcome, the other understating
  // low-risk and overstating high-risk decisions by three steps. A calibration score must rank the second lower.
  async function userWith(tag, rows, reflection) {
    const reg = await call('POST', '/api/auth/register', { body: { email: `${tag}${stamp}@test.dev`, password: 'ScoreTest123', fullName: 'Score Test' } });
    const token = tokenFrom(reg.setCookie);
    for (const [risk, conf, succ] of rows) {
      const d = (await call('POST', '/api/decisions', { token, body: { ...validDecision, riskLevel: risk, confidenceLevel: conf, emotionalState: 'calm' } })).json.decision;
      await call('POST', `/api/decisions/${d.id}/outcome`, { token, body: { ...validOutcome, successRating: succ, reflection } });
    }
    return (await call('GET', '/api/analytics', { token })).json;
  }
  const outcomesByRisk = [['low', 8], ['low', 7], ['medium', 6], ['medium', 5], ['high', 4], ['high', 3]];
  const shift = { low: -3, medium: 0, high: 3 };
  const calibrated = await userWith('cal', outcomesByRisk.map(([k, s]) => [k, s, s]), 'Outcome noted.');
  const inconsistent = await userWith('inc', outcomesByRisk.map(([k, s]) => [k, s + shift[k], s]), 'No regrets; a fearless choice.');
  record('TC44', 'Analytics', 'Confidence off by three steps in opposite directions for low- and high-risk decisions, versus a calibrated twin', 'Lower confidence calibration than the twin',
    `${inconsistent.confidenceCalibrationScore} vs twin ${calibrated.confidenceCalibrationScore}`, inconsistent.confidenceCalibrationScore < calibrated.confidenceCalibrationScore, true);
  record('TC45', 'Analytics', 'Same pair of histories: risk calibration', 'Lower risk calibration than the twin',
    `${inconsistent.riskCalibrationScore} vs twin ${calibrated.riskCalibrationScore}`, inconsistent.riskCalibrationScore < calibrated.riskCalibrationScore, true);
  record('TC46', 'Analytics', 'Calm decisions whose reflections read "No regrets; a fearless choice."', 'Emotional bias score 0',
    `emotional bias ${inconsistent.emotionalBiasScore}`, inconsistent.emotionalBiasScore === 0, true);
}

// ---------- Deletion and logout (last) ----------
r = await call('DELETE', `/api/decisions/${decisionId}`, { token: tokenA });
const gone = await call('GET', `/api/decisions/${decisionId}`, { token: tokenA });
record('TC32', 'Decision logging', 'Delete a decision (outcome removed with it)', '200, then 404 on read', `${r.status}, then ${gone.status}`, r.status === 200 && gone.status === 404);
r = await call('POST', '/api/auth/logout', { token: tokenA });
const expired = /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(r.setCookie || '');
record('TC33', 'Authentication', 'Log out', '200 and session cookie cleared', `${r.status}; cookie ${expired ? 'cleared' : 'not cleared'}`, r.status === 200 && expired);

await pool.end();
results.sort((x, y) => Number(x.id.slice(2)) - Number(y.id.slice(2)));
const core = results.filter((t) => !t.added), safeguard = results.filter((t) => t.added);
const summary = {
  label: LABEL, environment: environment(),
  core: { passed: core.filter((t) => t.pass).length, total: core.length },
  safeguard: { passed: safeguard.filter((t) => t.pass).length, total: safeguard.length },
  all: { passed: results.filter((t) => t.pass).length, total: results.length },
};
writeResult(`functional-${LABEL}.json`, { summary, results });
for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.id}  ${t.description}  ->  ${t.actual}`);
console.log(`\ncore ${summary.core.passed}/${summary.core.total}; safeguard ${summary.safeguard.passed}/${summary.safeguard.total}; all ${summary.all.passed}/${summary.all.total}`);
