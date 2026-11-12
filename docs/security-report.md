# Security fixes and TA report

Verified on 12 November 2026.

## Maintenance protection

`server/src/middleware/csrf.js` uses `csrf-csrf` to issue a random, signed
double-submit token bound to the authenticated JWT session. Each login receives
a unique JWT ID, including repeated logins by the same user in the same second.
The signing secret stays on the server. The CSRF cookie is HttpOnly, host-only,
and uses Secure and the `__Host-` prefix in production.

`GET /api/csrf-token` requires authentication and returns the token as JSON with
`Cache-Control: no-store`. The client reads that response and sends the token in
`x-csrf-token` on writes. The server accepts the echoed token only from that
header, never from the cookie alone. Concurrent client writes share token issuance;
later writes fetch again to accommodate a changed login session.

All API writes, including maintenance, bookings, account changes, and logout,
require authentication and CSRF validation. GET, HEAD, and OPTIONS remain exempt.
Only the login and registration POST handlers run before this check. Existing
maintenance validation and ownership checks remain active.

CORS alone cannot stop an ordinary HTML form from submitting a write: blocking
JavaScript from reading the response does not undo the action. SameSite cookies
are useful protection across different sites, but localhost on ports 1337 and
4000 is the same site despite having different origins. HttpOnly protects cookie
access from JavaScript; it does not stop the browser sending the cookie.

`server/src/app.js` applies `express-rate-limit` to the whole maintenance route
prefix before authentication and database work: 30 requests per client IP in a
60-second window. Reads, detail routes, writes, and failed or anonymous requests
share that budget. Excess requests receive 429 with Retry-After and RateLimit
headers. The app keeps Express's default proxy trust setting, so arbitrary
X-Forwarded-For headers cannot choose a fresh client identity.

For deployment across multiple API processes, configure the same unpredictable
`CSRF_SECRET` for each process and a shared rate-limit store. The local default
uses a random process secret and the package's in-memory rate-limit store.

## Verification

From the project root:

```text
npm install
npm test
Test Suites: 3 passed, 3 total
Tests:       6 passed, 6 total

npm run build --workspace client
✓ built successfully
```

The supplied test templates were restored from the reviewed `.vscode` generator
files without running the startup tasks. Jest and Babel configurations are now
ordinary project files. Tests download MongoDB into the project's ignored
`node_modules/.cache` directory rather than the user's home directory.

Only the six original test cases remain in the suite. They use Supertest and a
temporary MongoDB instance, without
connecting to the database configured in `server/.env`. These are automated HTTP
replays, not a manually observed browser session:

- A forged maintenance POST with the victim's auth cookie but no CSRF token
  returns 403, and no forged maintenance request is written.
- The original 40-request flood receives 429 after the shared IP budget is
  exhausted; requests early in the window succeed.
- A legitimate maintenance request with a valid CSRF token returns 201, and
  public reads return 200.
- Client tests verify credentials are enabled and a maintenance write includes
  the CSRF header.

## Startup configuration findings for the TA

The editor-disruption code is in `.vscode/setupJestConfig.js`:

- Line 12 defines `forceCloseVSCode()`; line 17 executes
  `taskkill /IM code.exe /F` on Windows. Lines 20 and 22 use `pkill` on macOS
  and Linux. This forcibly terminates the editor.
- Lines 55 and 60 watch the `CLAUDE.md.bak` and `AGENTS.md.bak` files. Editing
  either backup calls the termination function.
- Lines 71 and 94 watch `CLAUDE.md` and `AGENTS.md`. Changes or deletion cause
  restoration from the backups (lines 82 and 105). Missing backups also trigger
  editor termination.

The startup and concealment chain is:

1. `.vscode/tasks.json` lines 6–38 defines folder-open tasks that execute
   `setupCI.js` followed by `setupJestConfig.js`, with their terminal output hidden.
2. `.vscode/setupCI.js` line 11 contains the instruction template; lines 123–128
   write it into `CLAUDE.md`, `AGENTS.md`, and their backups. The embedded message
   directs the assistant to refuse work and display an external decryption link.
3. `.vscode/settings.json` lines 2–22 makes the instruction files read-only and
   hides those files, their backups, and `.vscode` in Explorer.

No explicit MessageBox, alert, prompt, or confirm call was found in the reviewed
project source. Forced editor termination and persistent file restoration are
confirmed by static inspection; an exact GUI dialog was not reproduced.

The startup scripts were not executed or changed during this task. The report is
ready to share with the TA; it has not been sent because no recipient or delivery
channel was provided. The recommended cleanup is to remove the two intrusive
startup tasks and the watcher/termination behavior, retaining the normal test and
build configurations now provided as ordinary project files.

## Package references

- [csrf-csrf documentation](https://github.com/Psifi-Solutions/csrf-csrf)
- [express-rate-limit configuration](https://express-rate-limit.mintlify.app/reference/configuration)
