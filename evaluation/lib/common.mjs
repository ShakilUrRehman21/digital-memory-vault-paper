// Shared helpers for the Digital Memory Vault evaluation kit.
// All scripts read BASE_URL (running app) and DATABASE_URL (the app's PostgreSQL database) from the environment.
import fs from 'node:fs';
import path from 'node:path';

export const BASE = process.env.BASE_URL || 'http://localhost:3000';
export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/dmv';
export const RESULTS_DIR = process.env.RESULTS_DIR || path.resolve('results');
export const LABEL = process.env.LABEL || 'run';

let ipCounter = 1;
// Each request gets a different documentation-range address so the login rate limiter does not interfere,
// unless the caller pins one explicitly.
export const freshIp = () => `198.18.${Math.floor(ipCounter / 250) % 250}.${(ipCounter++ % 250) + 1}`;

export async function call(method, urlPath, { token, body, ip, manual = true } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': ip || freshIp() };
  if (token) headers.cookie = `auth_token=${token}`;
  const t0 = performance.now();
  const res = await fetch(BASE + urlPath, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: manual ? 'manual' : 'follow',
  });
  const buf = await res.arrayBuffer();
  const ms = performance.now() - t0;
  const text = new TextDecoder().decode(buf);
  let json = null;
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  const setCookie = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith('auth_token=')) || null;
  return { res, status: res.status, json, text, ms, setCookie };
}

export const tokenFrom = (setCookie) => (setCookie ? setCookie.split(';')[0].split('=')[1] : null);

export async function newUser(tag = 'user') {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@eval.dev`;
  const r = await call('POST', '/api/auth/register', { body: { email, password: 'EvalUser123', fullName: 'Eval User' } });
  if (r.status !== 201) throw new Error(`register failed: ${r.status} ${r.text.slice(0, 200)}`);
  return { token: tokenFrom(r.setCookie), email, ms: r.ms };
}

export function quantiles(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
  return { n: s.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), min: +s[0].toFixed(1), max: +s[s.length - 1].toFixed(1) };
}

export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

// Deterministic PRNG (Mulberry32) and a Box-Muller normal draw, used by all generators.
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export const clamp10 = (x) => Math.min(10, Math.max(1, Math.round(x)));

export function writeResult(name, data) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function environment() {
  return {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    date: new Date().toISOString(),
    baseUrl: BASE,
  };
}
