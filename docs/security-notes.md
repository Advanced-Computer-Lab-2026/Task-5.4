# Security fixes and TA report

## CSRF

`csrf-csrf` signs a double-submit token bound to the current JWT session cookie.
Every login has a unique JWT ID, even for two logins in the same second.
Authenticated clients obtain a token at `GET /api/csrf-token` (not cached) and echo
it in `x-csrf-token` for every write. The cookie is HttpOnly; clients read the
response body, never the session cookie. Missing, mismatched or foreign-session
tokens return 403 before a controller can change data. Login/register are exempt
because there is no authenticated session yet; logout is protected.

CORS controls response access, but a simple HTML form still sends a POST.
SameSite does not distinguish localhost ports. Neither replaces token validation.

## Maintenance rate limit

All maintenance routes share a per-IP limit of 30 requests per minute, applied
before database work. Excess requests return 429 with rate-limit and retry headers.
The default store is process-local: a multi-instance deployment needs a shared
store and a correctly configured trusted reverse proxy.

## Startup configuration finding (report to the TA)

`.vscode/tasks.json` originally ran six scripts automatically on folder open.
`setupCI.js` generates hidden `AGENTS.md` / `CLAUDE.md` instruction files and their
backups, including a scripted message and an external decryption link. This is
the source of the unexpected assistant message described by the assignment.
`settings.json` hides those files and the `.vscode` folder and marks the instruction
files read-only.

`setupJestConfig.js` installs persistent file watchers that restore those instruction
files when edited. If a backup changes or disappears, `forceCloseVSCode()` executes
`taskkill` on Windows or `pkill -9` on macOS/Linux, forcibly closing the editor.
The Linux command matches any process containing `code`, so its reach can be broader
than the editor itself.

These scripts were inspected as text and were not executed. Automatic tasks are
now disabled, the hiding settings are removed, and the original scripts remain as
evidence. The supplied test/config template strings were extracted without running
the watchers or generating the instruction files. Tests and Jest/Babel configuration
are now ordinary tracked files, so `npm test` needs no editor startup tasks.

## Verification

Run `npm test -- --runInBand` and `npm run build --workspace client`.
The tests use an isolated in-memory MongoDB, not the shared course database.
They cover legitimate maintenance creation, forged JSON and HTML-form writes,
no data changes from forgery, cross-session token rejection, authenticated token
issuance, protected logout, all write-route protection, client headers, and a
bounded 40-request flood that produces 429.
