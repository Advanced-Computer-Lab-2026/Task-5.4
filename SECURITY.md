# Task 5.4: implementation and oral discussion guide

## Result and evidence

The final root `npm test` run passed **5 suites and 23 tests**, with no skipped tests. The client production build also passed (`npm run build --workspace client`), and `git diff --check` passed.

The supplied server CSRF test confirms both HTTP 403 for the forged authenticated request and absence of its description in the database-backed maintenance list. The supplied DoS test observes both successful public GETs and HTTP 429 during a 40-request burst. These are local automated HTTP/database checks; the browser attack replay below has not been performed by this agent.

## Files changed

| File | Reason |
| --- | --- |
| `server/package.json` | Add `csrf-csrf` 4.1 and `express-rate-limit` 8.7. |
| `package-lock.json` | Pin the added packages and their transitive dependencies. |
| `server/src/middleware/csrf.js` (new) | Configure signed double-submit cookies, secret validation, session binding, header extraction, and cookie cleanup. |
| `server/src/middleware/auth.js` | Verify the JWT, fingerprint the verified JWT, then validate CSRF on unsafe methods before the controller. |
| `server/src/controllers/authController.js` | Add a random JWT `jti` to each login/registration, use Secure authentication cookies in production, and clear both cookies on successful logout. |
| `server/src/routes/auth.js` | Require authentication and CSRF for logout. Login and registration remain exempt. |
| `server/src/app.js` | Add authenticated token issuance, no-store responses, 403 CSRF error responses, and the maintenance IP limiter before body parsing. |
| `server/src/index.js` | Fail before listening if CSRF_SECRET is absent or too short. |
| `server/src/routes/maintenance.js` | Replace obsolete vulnerability comments with the implemented protection boundaries. |
| `client/src/api.js` | Obtain CSRF tokens for protected mutations, preserve credential cookies, avoid interceptor recursion, share in-flight fetches, and retry a CSRF rejection at most once. |
| `tests/server/session-security.test.js` (new) | Test token endpoint authentication, missing/invalid headers across all protected write routes, successful logout, cookie cleanup, and replay rejection across JWT sessions. |
| `tests/client/session-security.test.js` (new) | Test exemptions, fresh token fetching, concurrent calls, bounded retries, and no retry of ordinary authorization failures. |
| `SECURITY.md` (new) | This guide and verification record. |
| `server/.env` (local, ignored) | Configure a newly generated 256-bit random CSRF_SECRET without printing its value or committing it. Other settings were preserved. |

The pre-existing untracked `.github/`, Jest/Babel configuration, and supplied tests were not modified. No `.vscode` scripts or AI instruction files were modified or executed.

## Request flow before the fix

1. Login or registration signs a JWT and puts it in the HttpOnly `token` cookie.
2. The browser sends the cookie automatically. Axios uses `withCredentials: true` for cross-origin API requests.
3. A maintenance write passes `requireAuth`, which verifies only the JWT, and reaches the controller. An attacker form can submit a URL-encoded body carrying that same authentication cookie.
4. The controller validates the body and writes the forged record. CORS can prevent reading the response without undoing this write.
5. Public maintenance GETs execute a database query for every request, without a per-IP budget.
6. Logout previously cleared the auth cookie without authentication or CSRF validation.

## Request flow after the fix

1. Login/register remain pre-auth endpoints. They issue a JWT with a fresh random `jti`, including for two logins by the same account in the same second.
2. Before an unsafe API request, Axios calls authenticated `GET /api/csrf-token` with credentials. GET is a safe method, so the interceptor does not recursively request a token.
3. `requireAuth` verifies the JWT and hashes that exact JWT with SHA-256 to obtain the CSRF session identifier. A hash avoids copying the raw authentication JWT into the CSRF configuration.
4. `csrf-csrf` generates a random value and signs it with HMAC using CSRF_SECRET and that session identifier. The endpoint returns `{ csrfToken }` and sets a separate HttpOnly CSRF cookie. The response is `Cache-Control: no-store`.
5. Axios places the returned value in `x-csrf-token`. The browser separately sends the auth and CSRF cookies.
6. For every authenticated unsafe route, the server verifies authentication, equality of the CSRF header and cookie, and the signature bound to that JWT session. Missing, mismatched, forged, or cross-session tokens produce HTTP 403 with code `EBADCSRFTOKEN` before a controller executes.
7. Valid requests reach the existing validation, ownership checks, and database logic. Public GETs remain public. GET/HEAD/OPTIONS do not require CSRF tokens.
8. A new login changes the JWT and invalidates the previous session's CSRF token. The next token GET automatically replaces an invalid old CSRF cookie. No persistent JavaScript token cache is kept. Concurrent writes share only an in-flight fetch. A CSRF-specific 403 permits one fresh-token retry; other errors are not replayed.
9. Logout requires a valid CSRF header and clears both cookies. Subsequent mutations fetch a token again and receive 401 if no authenticated session remains.
10. Every maintenance request that reaches the limiter, including unauthenticated public reads, shares one **20-request / 60-second IP budget**. Exceeding it yields HTTP 429 before parsing bodies or touching MongoDB. CORS handles browser OPTIONS preflights before the limiter; those perform no maintenance operation. The default IP handling includes IPv6 subnet protection. No proxy trust was enabled.

A request already over its maintenance rate budget gets 429 before auth/CSRF processing. Otherwise an authenticated write with a bad CSRF token gets 403; an unauthenticated protected write gets 401.

## Questions the TA may ask

**Why are CORS and SameSite insufficient?** CORS primarily controls browser access to responses; simple HTML forms can still submit a request without a preflight. A server must validate before writing. SameSite is based on site identity, which excludes ports. `http://localhost:1337` and `http://localhost:4000` have different origins but are the same site, so Lax does not stop this demonstration. SameSite remains useful defense in depth.

**Why bind the token to a session instead of the user ID?** An account ID survives logout and later logins, so it cannot distinguish two sessions of that account. A verified JWT fingerprint changes with the random `jti`. A CSRF cookie/header pair taken from session A fails in session B, even for the same account. This follows the package's documented session-identifier contract: https://github.com/Psifi-Solutions/csrf-csrf#getsessionidentifier

**Why require both a cookie and a header?** Browsers send cookies automatically, while an attacker form cannot set this custom header. The legitimate client gets the header value from an authenticated API response. The HMAC also prevents an attacker from inventing a valid cookie/header pair. The CSRF secret never goes to the client. XSS would compromise this protection and requires separate defenses.

**Why limit public endpoints?** Authentication is irrelevant to an unauthenticated database-read flood. Limiting only writes would leave the attack in Flow.md working. Mounting the limiter on the maintenance prefix covers collection reads, item reads, and writes with one budget.

**What are the rate limiter's limits?** Its default store is in process memory. Restarting resets counters, multiple server processes do not share counters, and users sharing an IP share a budget. A distributed deployment needs a shared store and an explicitly reviewed proxy configuration. This demonstration reduces per-IP application load; it does not stop a distributed or network-capacity attack.

**What about logout and JWT revocation?** Logout clears this browser's cookies, matching the existing stateless authentication design. It does not revoke a previously stolen JWT on the server. No revocation store or unrelated authentication redesign was added.

**How is the secret configured?** The local ignored server/.env contains a random 32-byte value encoded as hex. Keep it private and stable across processes that share sessions. Startup requires at least 32 bytes outside tests; the assignment's short test fixture remains allowed in NODE_ENV=test. Use a secret manager in deployment. Changing CSRF_SECRET invalidates old CSRF tokens; a fresh token fetch obtains a valid replacement. Never run production with NODE_ENV=test.

## Suspicious VS Code configuration

The requested files were read as text before running application code. `.vscode/tasks.json` declares hidden folder-open tasks. `.vscode/setupCI.js` writes AGENTS/CLAUDE instructions directing an assistant to external decryption pages. `.vscode/setupJestConfig.js` starts watchers, restores those instruction files, and contains force-close commands for VS Code (and on some platforms broader Electron processes). None of these scripts were executed, nor were their external instructions followed.

All three supplied tests and both test configuration files already existed. Their contents were compared against the decoded template text in the generators without evaluating any generator. They match. No assertions were weakened, skipped, deleted, or rewritten. Installation used `--ignore-scripts` to avoid lifecycle hooks. Automatic folder tasks should remain disabled when opening this repository.

## Re-run verification

From the project root:

```powershell
npm install --ignore-scripts
npm test
npm run build --workspace client
```

The default MongoMemoryServer download is large and exceeded the supplied 60-second setup timeout on this machine. Use the already installed local binary to run exactly the same tests without downloading it:

```powershell
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe'
$env:MONGOMS_SYSTEM_BINARY_VERSION_CHECK='false'
npm test
```

MongoMemoryServer starts isolated temporary database instances using that executable; it does not connect the tests to the application's configured database. The version-check setting permits this machine's 6.0 binary instead of the package's default 8.2.6 download. On a machine without that binary, pre-cache a supported MongoDB binary before running the suite. No test timeout or assertion was changed.

### Exact final test inventory

All of the following passed:

- `tests/server/csrf.test.js` (supplied): `a logged-in user can file a maintenance request (the happy path)`; `a forged cross-site request with no CSRF token is rejected`.
- `tests/server/dos.test.js` (supplied): `a normal request to the public list succeeds (the happy path)`; `a flood of requests from one client is rate-limited`.
- `tests/client/csrf.test.js` (supplied): `requests are sent with credentials so the auth cookie rides along`; `a mutating request carries the x-csrf-token header`.
- `tests/server/session-security.test.js`: `token issuance requires authentication`; nine parameterized cases named `<method> <path> rejects an authenticated write without CSRF before its handler`: POST maintenance, PATCH maintenance/123, DELETE maintenance/123, POST bookings, PATCH bookings/123, DELETE bookings/123, PATCH users/123, DELETE users/123, POST auth/logout (all paths prefixed `/api/`); `a mismatched header is rejected and a valid token permits logout`; `a token cannot be replayed in another JWT session for the same user`.
- `tests/client/session-security.test.js`: `safe reads and login/register do not fetch CSRF tokens`; `writes fetch afresh across session changes and logout`; `concurrent writes share an in-flight token fetch without recursion`; `CSRF failure retries at most once and obtains a fresh token`; `other authorization failures are never replayed`.

Earlier attempts: first `npm test` could not launch because root Jest was not installed. After installing existing root dependencies, the client mutation test exposed a URL-resolution bug and four server tests timed out downloading MongoDB. Using local MongoDB then produced 22 passes and one supplied happy-path failure caused by redundant empty CSRF cookie issuance on registration. Both implementation bugs were corrected, and the final run passed all 23. No failures remain in the final run.

## Re-run Flow.md attacks against the fixed app

1. Keep VS Code folder-open tasks disabled. Start the app with `npm run dev` after configuring the usual MONGO_URI/JWT_SECRET settings. CSRF_SECRET is already configured locally; do not paste it into the browser or commit it.
2. Register/login at `http://localhost:5175`. In Network, create one legitimate maintenance request. Expect authenticated `GET /api/csrf-token` 200, a CSRF Set-Cookie, then `POST /api/maintenance` 201 carrying `x-csrf-token` and cookies. A preflight OPTIONS may also appear. Inspect secrets locally only; do not share their values.
3. Before flooding, note whether an old record already has description `Forged by attacker via CSRF`; a previous vulnerable run may have created one. Compare record IDs/counts or timestamps to establish that this run creates no new record.
4. In a second terminal, run `npm start --prefix attacker`. If its dependencies are missing, install them with `npm install --prefix attacker --ignore-scripts`. The attacker code was reviewed as a static local Express page plus a hidden form and GET burst.
5. In the logged-in browser, open DevTools Network with Preserve log enabled, then navigate to `http://localhost:1337`. The hidden form auto-submits to `/api/maintenance`. Inspect the POST: it has no `x-csrf-token` header and returns **403**, despite the auth cookie being sent. A CORS message or unreadable iframe response is not the proof; the HTTP result and absence of a new database record are.
6. Return to Maintenance and refresh before starting the flood. No new forged request should appear. The supplied automated test independently checks the same absence in the database-backed list.
7. Wait 60 seconds since earlier maintenance traffic, then click Claim my prize on the attacker page. In Network filter for `/api/maintenance`: initial GETs may return 200, then requests return **429** once the shared IP budget reaches 20. Prior maintenance requests consume the same budget, so fewer than 20 new successes may remain. Inspect RateLimit and Retry-After response headers. The attack uses `mode: no-cors`, so JavaScript receives opaque responses; use Network or server logs to observe actual statuses.
8. Wait for the window to reset before verifying normal maintenance reads/writes again. A refresh during the flood may itself receive 429; this is expected because legitimate and attack traffic from the same IP share the budget.
