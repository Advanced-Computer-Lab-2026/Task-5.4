# Task 5.4 implementation and learning notes

The assignment asks for two independent defenses: CSRF tokens for cookie-authenticated
writes, and rate limiting for every maintenance endpoint. It also asks us to identify
the editor interruption code. No `.vscode/setup*.js` scripts were executed or restored.
Dependencies were installed using `npm install --ignore-scripts`.

## Documentation to code

These are small adaptations of the official examples, with project-specific choices
explained below. Follow the links alongside the implementation to learn the APIs.

| Official reference | Implementation | What to look for |
| --- | --- | --- |
| [csrf-csrf configuration](https://github.com/Psifi-Solutions/csrf-csrf#configuration) | [csrf.js](../server/src/middleware/csrf.js) | `doubleCsrf`, `getSecret`, `getSessionIdentifier`, header validation |
| [csrf-csrf token generation](https://github.com/Psifi-Solutions/csrf-csrf#generatecsrftoken) | [app.js](../server/src/app.js) | Authenticated `GET /api/csrf-token` returns the token and sets its cookie |
| [express-rate-limit usage](https://express-rate-limit.mintlify.app/quickstart/usage) | [app.js](../server/src/app.js) | `rateLimit` mounted on the whole maintenance path |
| [Axios interceptors](https://axios-http.com/docs/interceptors) | [api.js](../client/src/api.js) | Async request interceptor attaches `x-csrf-token` before writes |

### CSRF request flow

1. Login or registration sets the HttpOnly JWT cookie. Each JWT gets a random `jti`
   so two logins by the same user, even within one second, are separate sessions.
2. Before a write, the client fetches `/api/csrf-token` with credentials.
3. The API authenticates that request, then generates a random token signed using
   its server secret and bound to the session JWT. It sets an HttpOnly CSRF cookie
   and returns the token in JSON with `Cache-Control: no-store`.
4. The client echoes the JSON value in `x-csrf-token`. The library checks both the
   cookie/header match and the signature's session binding before the controller runs.
5. Missing, incorrect, or another session's tokens return `403` without a mutation.

The server secret and JWT never need to be exposed to client JavaScript. The client
uses the returned CSRF token, not the secret. Fetching for every write avoids storing
a token that becomes stale after a login in another tab; simultaneous writes share
one pending token request. A failed token fetch prevents the write.

The guard covers all API writes, including bookings, user changes, and logout.
`GET`, `HEAD`, and `OPTIONS` stay exempt. Only `POST /api/auth/login` and
`POST /api/auth/register` bypass it because these establish the session. Authentication
and ownership checks remain in the routes/controllers. Login changes the session JWT,
invalidating the old CSRF token; the next fetch replaces it. Logout clears both cookies.

For local HTTP the CSRF cookie uses an ordinary name with `secure: false`. Production
uses `__Host-csrf-token` with `Secure`, HttpOnly, `Path=/`, and no Domain attribute.
Set `CSRF_SECRET` to a strong, persistent random value shared by API replicas. Without
it, local development uses a process-random secret; restarting invalidates old CSRF
tokens, and replicas would disagree about them. Production requires HTTPS.

CORS alone does not stop a plain HTML form from sending its request. It controls
whether the attacking script can read the response. That reading restriction helps
keep the JSON CSRF token unavailable to the attacker's origin. SameSite is another
layer, but `localhost:1337` and `localhost:4000` are same-site despite being different
origins: changing the port does not change the site. The missing header and signed
token check are what reject this demo's forged form.

### Rate limiting

The maintenance path allows 30 requests per IP per 60 seconds across list, detail,
create, update, and delete. Further requests receive JSON with status `429`, rate
limit headers, and `Retry-After`. The limiter runs before CSRF validation/controllers,
so forged writes also consume the budget and excess requests never query MongoDB.

This is a small teaching-app limit, not comprehensive protection against distributed
DoS. The default store is per process; use a shared store across replicas. A deployment
behind a reverse proxy also needs a correctly scoped Express `trust proxy` setting.

## Finding to share with your TA

The files below were already deleted in the working tree when this work began. They
were inspected read-only using `git show HEAD:<path>`; those deletions were preserved.

- `.vscode/tasks.json`: the task named **Generate Jest Config** runs
  `node .vscode/setupJestConfig.js` on `folderOpen`, after **Generate GitHub CI YAML**.
- `.vscode/setupJestConfig.js:12`: `forceCloseVSCode()` executes
  `taskkill /IM code.exe /F` on Windows at line 17, forcibly terminating VS Code.
  It contains equivalent `pkill` commands for macOS/Linux.
- `.vscode/setupJestConfig.js:55` and `:60`: `fs.watch` handlers call this function
  when `CLAUDE.md.bak` or `AGENTS.md.bak` changes. Later watchers restore the main
  instruction files from the backups after editing/deletion, and also kill the
  editor if a backup is missing during restoration.
- `.vscode/setupCI.js`: writes the generated instruction files and backups as well
  as CI configuration. The instructions redirect assistants away from the assignment.
- `.vscode/settings.json`: hides `.vscode` and the instruction/backup files in the
  Explorer, and marks the main instruction files read-only in the editor.

This explains forced editor exits and could cause a recovery dialog on restart.
No direct dialog-creation call was found in these scripts; the observed code performs
termination and file restoration. Do not attribute an arbitrary dialog to it without
checking the actual dialog text. No TA message was sent from this session.

## Verification

Run `npm test -- --runInBand` from the root. Tests use an isolated in-memory MongoDB;
they do not use the MongoDB credentials in the README. The first run downloads MongoDB.
The additional tests exercise the same URL-encoded form payload and localhost origin
as `Flow.md`, token replay between sessions, the legitimate create/update/delete path,
logout/session rotation, all protected write groups, and client token-fetch failure.
The supplied flood test checks both successful normal traffic and `429` responses.

For the browser walkthrough in `Flow.md`, expect the hidden form's POST to return
`403` and leave the request list unchanged, and the flood's excess GETs to return
`429`. Inspect these statuses in DevTools: the attacker's `no-cors` fetch cannot read
the API's response. Automated HTTP tests and a manual browser walkthrough are distinct
checks; test results alone do not establish that the browser walkthrough was run.

### Results in this session

- **Passed:** all 23 tests across all four suites, including the real MongoDB
  integration tests, using `npm test -- --runInBand --detectOpenHandles`. Jest exited
  cleanly without an open-handle warning.
- **Fixed test setup:** the first-time MongoDB download previously exceeded the
  60-second `beforeAll` timeout, leaving its download active after the tests ended.
  `tests/server/globalSetup.cjs` now prepares the binary once before timed hooks and
  workers start. The integration suites assign the MongoDB instance before starting
  it, and use `finally` in teardown so stopping MongoDB is attempted even if Mongoose
  disconnection fails. This follows the library's
  [Jest setup guidance](https://typegoose.github.io/mongodb-memory-server/docs/guides/integration-examples/test-runners/).
- **Local cache:** the MongoDB executable was extracted from the already downloaded
  official ZIP prefix and checked against the entry's size and CRC from the official
  ZIP directory. The cache includes the checksum sidecar expected by the library.
- **Not run:** the manual browser walkthrough and any file-regeneration scripts.

To rerun only the verified tests:

```powershell
npm test -- --runInBand --runTestsByPath tests/server/protections.test.js tests/client/csrf.test.js
```

For the full suite, run `npm test`. Global setup downloads/caches MongoDB on first
use, outside Jest's 60-second setup hook. Alternatively set `MONGOMS_SYSTEM_BINARY`
to an existing compatible `mongod.exe`. Do not run `.vscode/setup*.js` to prepare
the suite.
