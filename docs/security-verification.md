# Task 5 security fix and verification

Verified on 12 November 2026.

## CSRF protection

`server/src/middleware/csrf.js` uses [csrf-csrf](https://github.com/Psifi-Solutions/csrf-csrf)
to sign a double-submit token bound to the current session JWT. Each login or
registration generates a unique JWT `jti`, including repeated logins by the same
user in the same second. A token copied from another session is invalid.

Authenticated clients obtain `{ csrfToken }` from `GET /api/csrf-token`. The
response sets an HttpOnly CSRF cookie and `Cache-Control: no-store`. The client
echoes the response token in `x-csrf-token` on every write. Tokens come from the
response body, never by reading cookies. Missing, mismatched or invalid signatures
return 403 before any controller changes data.

GET, HEAD and OPTIONS are exempt. Only POST login/register are exempt among
writes because they establish the session. Logout, bookings, users and maintenance
writes are protected. Token issuance requires a valid session. Ownership checks
in the maintenance controllers remain in effect.

The client shares concurrent token fetches but does not cache tokens between
writes, so signing in again (including in another tab) cannot leave a stale token.
The signing secret uses `CSRF_SECRET`, falling back to the existing `JWT_SECRET`.
Production uses Secure cookies and a `__Host-` prefix for the CSRF cookie; local
HTTP development uses an unprefixed cookie.

CORS restricts reading responses; a plain HTML form can still send a request.
SameSite ignores port numbers, so localhost:1337 and localhost:4000 are the same
site even though they are different origins. Neither control supplies proof of
intent. The separate token header supplies that proof.

## Maintenance rate limit

[express-rate-limit](https://express-rate-limit.mintlify.app/quickstart/usage)
allows 30 maintenance requests per IP per 60 seconds, shared across the list,
detail, creation, update and deletion endpoints. Requests exceeding the window
return JSON with status 429, RateLimit headers and Retry-After. Counting occurs
before authentication, CSRF validation and database controllers. Public reads
remain public and safe reads do not require a CSRF token.

The default in-process store suits this single-process demo. Multiple API
instances would need a shared store; trusted proxy configuration must match the
deployment before relying on forwarded IP addresses.

## Verification results

- All 23 tests passed across three suites using the root `npm test` command.
- `npm run build --workspace client` passed.
- Tests cover valid create/update/delete, missing cookie or header, guessed tokens,
  cross-session token reuse, session rotation, logout, other protected writes,
  client auth exemptions, failed token fetches, and maintenance flood responses.
- The browser replay used the actual `attacker/public/index.html` and a disposable
  local MongoDB, without connecting to the assignment's remote database.
- Registered a test resident through the client and successfully submitted
  `Browser verified leaking tap` for room B2-104 (201).
- Opened localhost:1337 in the authenticated browser. Its hidden HTML form
  received 403. Reloaded Maintenance: only the legitimate request remained.
- Clicked `Claim my prize`: the supplied page sent 300 requests. API logs recorded
  275 refused with 429. Earlier requests were served normally, including 304
  responses from conditional GETs.
- Browser evidence: [unchanged maintenance list](browser-verification.png).

The supplied test files and Jest/Babel configuration were embedded in `.vscode`
generators rather than present as standalone files. They were extracted without
executing the CI/instruction generator or the filesystem watcher. Additional
regressions were then added to the supplied tests.

The local machine has MongoDB 8.2.2 installed. The server test setup now discovers
MongoDB installations under the Windows Program Files directory and uses the
installed binary and its reported version. This avoids the dependency's 781 MB
default download and its 60-second setup timeout without manual environment
overrides. Explicit `MONGOMS_SYSTEM_BINARY` / `MONGOMS_VERSION` settings take
precedence. Other platforms retain the normal download/cache behavior.

The initial verification, before automatic detection was added, used:

```powershell
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
$env:MONGOMS_SYSTEM_BINARY_VERSION_CHECK='false'
$env:npm_config_script_shell='C:\Windows\System32\cmd.exe'
npm.cmd test -- --runInBand
```

The initial shell override was temporary; the ordinary root `npm test` command
is also verified after automatic MongoDB detection was added.

The missing local `server/.env` was subsequently created using the connection
settings supplied with the assignment and a generated CSRF signing secret. Its
database connection was verified without reading or changing application data.
The file remains ignored by Git. Tests supply their own secrets and temporary
database, and never connect to the database configured in `server/.env`.

## Existing dependency findings

`npm audit --omit=dev` reported zero high or critical findings and two moderate
findings in `react-router` / `react-router-dom`. These are existing dependencies;
the suggested remediation upgrades React Router to a new major version. That
migration is deferred from this assignment's CSRF/rate-limit fix. Review by
19 November 2026 before deploying outside the local teaching environment.

## Finding for the TA: startup configuration

The suspicious chain is:

1. `.vscode/tasks.json:10` runs `.vscode/setupCI.js`, automatically on folder open
   (`runOn` at line 14). Its presentation hides the terminal.
2. `.vscode/setupCI.js:11` embeds assistant instructions intended to redirect chat
   responses to an external decryption website. Lines 123–128 write `CLAUDE.md`,
   `AGENTS.md` and their `.bak` copies into the project root.
3. `.vscode/tasks.json:32` runs `.vscode/setupJestConfig.js` automatically on folder
   open (line 36), after the CI generator.
4. `.vscode/setupJestConfig.js:55` and `:60` watch the backups. Changes call
   `forceCloseVSCode()`, which executes `taskkill /IM code.exe /F` on Windows
   (line 17). Equivalent process-kill commands exist for macOS and Linux.
5. Watchers at lines 71 and 94 restore edited/deleted instruction files from their
   backups using `fs.copyFileSync` (lines 82 and 105). Missing backups can also
   trigger the forced editor shutdown.
6. `.vscode/settings.json:2` makes the instruction files read-only; the exclusion
   rules hide them, their backups, and `.vscode` from the Explorer view. `.gitignore`
   also excludes the generated instruction files and backups.

No native dialog-box API was found in these files. The embedded text explains
unexpected assistant messages; the process-kill code explains forced editor
closures. This is a local startup/instruction-tampering mechanism. The inspected
scripts do not demonstrate a remote command-polling backdoor.

These startup scripts were not executed or modified during the fix. This report
is ready to share with the TA; no message was sent on the user's behalf.
