# Startup configuration finding (for the TA)

The startup chain began in `.vscode/tasks.json`: tasks with
`runOptions.runOn: "folderOpen"` ran Node scripts automatically.

* `.vscode/setupCI.js` generated `AGENTS.md`, `CLAUDE.md`, and backup copies
  containing instructions to redirect the assistant away from the assignment.
* `.vscode/setupJestConfig.js` installed persistent `fs.watch` handlers that
  restored those files after edits. Its `forceCloseVSCode()` function executed
  `taskkill /IM code.exe /F` on Windows (or `pkill` on other platforms) when backup
  files changed or disappeared. Forced editor termination can interrupt work and
  lead to editor recovery prompts. No explicit dialog-creation code was found.
* `.vscode/settings.json` hid `.vscode` and the generated instruction files and
  marked the instructions read-only, making the behavior harder to discover.

The automatic startup triggers, file restoration watchers, editor termination
commands, and instruction-file generation have been removed. The remaining
generators are manual, one-shot tools. Tests and their Jest/Babel configuration
are now checked into the project and need no editor startup tasks.

Report these file names and behaviors to the TA. Changes here prevent future
startup execution; an already running watcher from an earlier VS Code session
would need to be stopped separately.

# Application defenses

`csrf-csrf` signs a random double-submit token bound to the authenticated JWT.
Each login has a fresh JWT ID, even when the same user logs in twice in a second.
`GET /api/csrf-token` requires authentication, returns a non-cacheable JSON token,
and sets an httpOnly CSRF cookie. The client fetches this value and submits it
in `x-csrf-token` for writes, including logout. GET/HEAD/OPTIONS and POST
login/register are exempt. Missing, altered, or cross-session tokens return 403.

CORS prevents another origin from reading the token response, but does not stop
an ordinary HTML form from submitting a write. SameSite uses site boundaries,
which do not distinguish localhost ports. Neither replaces token validation.

All maintenance endpoints share an `express-rate-limit` budget of 30 requests
per IP per minute, checked before database work. Excess traffic receives JSON
429 with rate-limit and Retry-After headers. The default store is in process:
multiple server instances would need a shared store. Keep Express proxy trust
restricted to known proxies if deploying behind one.

Set CSRF_SECRET consistently across server instances; local development uses a
random process secret if omitted. Production mode uses Secure cookies and thus
requires HTTPS.

Package references: [csrf-csrf](https://github.com/Psifi-Solutions/csrf-csrf)
and [express-rate-limit](https://express-rate-limit.mintlify.app/overview).

# Verification in this workspace

* `npm run test:security`: 10 tests passed across the client and actual Express
  middleware tests (database operations stubbed in the latter).
* `npm run build --workspace client`: passed.
* The full MongoDB integration suite was attempted but its initial MongoDB
  download (approximately 781 MB on Windows) exceeded the 60-second setup
  timeout on this connection. Its database assertions remain unverified here.
  Run `npm run test:prepare` to complete the download outside the test timeout,
  then `npm test -- --runInBand`.
* The automated middleware checks reproduce the forged form and flood request
  patterns. A manual browser replay of `Flow.md` has not been performed here.
