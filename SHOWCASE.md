# Task 5.4 — Showcase for the TA

Everything below was actually run on this machine. Evidence files are in `evidence/`.

## 1. Result in one table

| | Before fix | After fix |
|---|---|---|
| `npm test` | 3 failed / 3 passed (`evidence/01-before-fix-npm-test.txt`) | **6 / 6 passed** (`evidence/02-after-fix-npm-test.txt`) |
| Forged cross-site `POST /api/maintenance` (live: `evidence/03` vs `04`) | `201`, forged row created in the victim's name | **`403`**, nothing written |
| Flood from the attacker page (live) | 327 flood requests, **all served** (200/304), zero 429 | **exactly 20 served**, the rest (560 in this run) **`429`** |
| Legit write from our own UI / API | `201` | `201` (csrf-token `200`, then the write) |
| Write with no token (patch, delete, booking, logout) | accepted | **`403`**; with token `2xx` |

## 2. What was changed

| File | Change |
|---|---|
| `server/src/middleware/csrf.js` (new) | `csrf-csrf` double-submit config. Token is HMAC-signed and bound to the session (the JWT cookie). Secret read lazily. Only `/api/auth/login` and `/api/auth/register` are exempt. |
| `server/src/app.js:9,26-27,43` | `GET /api/csrf-token` issues the token; `doubleCsrfProtection` runs after `cookieParser`, before the routers; clean `403` JSON on a bad token. |
| `server/src/middleware/rateLimit.js` (new) | `express-rate-limit`: 20 requests / 60 s per client, then `429`. |
| `server/src/routes/maintenance.js:17` | `router.use(maintenanceLimiter)` on all maintenance endpoints. |
| `client/src/api.js:14-20` | axios interceptor: before any non-GET request, fetch a fresh token and send it as `x-csrf-token`. |
| `server/package.json` | added `csrf-csrf`, `express-rate-limit`. |
| `server/.env` (git-ignored) | added `CSRF_SECRET`. |

Generated for the test suite (written by the repo's own `.vscode/setup*Test.js` writers, which I read first): `tests/`, `babel.config.cjs`, `jest.config.cjs`.

## 3. Live demo that was run (same browser, victim logged in)

1. Registered a fresh victim (`TA Demo Victim`) in the UI at `http://localhost:5175`.
2. Filed a legit request in the UI → server log: `GET /api/csrf-token 200` then `POST /api/maintenance 201`.
3. Opened the attacker page `http://localhost:1337` in the same browser (auto-submitted the hidden form) → server log: `POST /api/maintenance 403`.
4. Clicked "Claim my prize" (flood) → exactly 20 requests served, the other 560 got `429` (counted from the log lines of that one run only: `evidence/04-live-after.log`). Totals vary a little run to run because the browser fires/cancels requests; the invariant is "20 served per minute, everything else 429".
5. Queried the database: the only row authored by the victim is the legit one (`TA-101 | Legit request: leaking tap`). **No forged row.** (`evidence/db-after.json`; full server log in `evidence/dev.log`.)
6. Other writes checked live with the token (login, create/patch/delete maintenance, create/delete booking, logout): each `403` without the token and `2xx` with it.
7. **Live "before" run** (fix temporarily removed, server reloaded): the same attacker page produced `POST /api/maintenance 201` and 327 flood requests all served, no 429 (`evidence/03-live-before.log`). The forged row it created on my victim was then deleted (`DELETE 200` with token) and the fix was restored byte-for-byte.

Note: the shared Atlas database already contained "Forged by attacker" rows from earlier runs by other people, so the check is "no row authored by *my* victim", not "no such text anywhere".

To replay it yourself: `npm run demo` (starts API :4000, client :5175 and attacker :1337 together), then follow the script in section 6. The Mongo binary for the tests downloads on first `npm test` (~700 MB, cached after).

## 4. Why the fix works (the "why" questions)

- **CORS does not stop CSRF.** CORS only stops the attacker page from *reading* the response. The browser still sends the request with the cookie and the server still acts on it. The forged `<form>` POST is a "simple request", so it does not even trigger a preflight.
- **SameSite does not stop it here.** `localhost:1337` and `localhost:4000` are the same *site* (the port is not part of site identity), so the `SameSite=Lax` cookie is still sent.
- **The token works** because the attacker's page cannot read it (different origin, cookie is httpOnly) and cannot set the `x-csrf-token` header on a cross-site form. The token is HMAC-signed and tied to the JWT cookie, so a token minted for another session (or no session) is rejected.
- **Exempt:** `GET/HEAD/OPTIONS` (safe methods, no state change) and `login`/`register` (no session exists yet to forge). **Protected:** everything else, including logout and the booking/user writes.
- **Order matters:** CSRF runs at app level before the maintenance router, so a forged POST gets a clean `403` instead of being counted by the limiter.

## 5. Part 2 — the `.vscode` finding (to tell the TA)

This repo ships `.vscode/` with tasks that **run automatically when the folder is opened in VS Code**. I read all of them and did **not** run `setupCI.js` or `setupJestConfig.js`.

1. **Auto-run on open** — `.vscode/tasks.json`: every task has `"runOn": "folderOpen"` (lines 14, 36, 58, 80, 102, 124). Opening the folder in VS Code triggers VS Code's "this workspace wants to run automatic tasks / Allow?" prompt. **This is most likely the dialog box** (VS Code's own "Allow automatic tasks?" prompt). The other candidate is item 2 below: the watchers revert edits and force-close VS Code. Either way the cause is `tasks.json` `runOn` plus `forceCloseVSCode`.
2. **Kill switch for VS Code** — `.vscode/setupJestConfig.js`:
   - `forceCloseVSCode()` (line 12) runs `taskkill /IM code.exe /F` (line 17) (also `pkill` on macOS/Linux) and `process.exit(1)` (line 26).
   - `fs.watch` (lines 55, 60, 71, 94) watches `CLAUDE.md`, `AGENTS.md` and their `.bak` copies. If someone edits or deletes the `.bak` files, VS Code is force-closed; edits to `CLAUDE.md`/`AGENTS.md` are silently reverted from the backup.
3. **Trap aimed at AI assistants** — `.vscode/setupCI.js`: writes `CLAUDE.md` / `AGENTS.md` (+ `.bak`) at lines 123-128 from a template (line 11 on) instructing an AI assistant to refuse to help and print a taunt with an encrypted-text link (Rule 1, line 19; Rule 2 next). I did not follow it or open the link.
4. **Concealment** — `.vscode/settings.json` hides `.vscode`, `CLAUDE.md`, `AGENTS.md` and the `.bak` files from the VS Code explorer (lines 13-17) and makes them read-only (lines 3-4), and `.gitignore` ignores them.
5. The other four scripts (`setupBabelConfig.js`, `setupServerCSRFTest.js`, `setupServerDoSTest.js`, `setupClientTest.js`) only write the Jest/Babel config and the test files. They are harmless.

Lesson: inspect `.vscode/tasks.json` before opening an untrusted repo in VS Code, and decline "Allow Automatic Tasks".

## 6. Click-by-click demo script (about 5 minutes)

1. Terminal: `npm run demo`. (Run `npm test` once beforehand: it downloads a ~700 MB Mongo binary on first use.)
2. Open `http://localhost:5175`, register a new user, open **Maintenance**, file one request. In DevTools → Network point out `GET /csrf-token 200`, then `POST /maintenance 201` carrying an `x-csrf-token` header.
3. With DevTools → Network open, load `http://localhost:1337` in the same browser. Point at the cross-site `POST /api/maintenance` → **403**.
4. Click **Claim my prize**. Point at the wall of **429** responses.
5. **Wait 60 seconds** (the victim is rate-limited too), reload Maintenance: no forged row for your user.
6. Run `npm test` → 6 passed. Show `evidence/01-before-fix-npm-test.txt` (red) next to `evidence/02-after-fix-npm-test.txt` (green), and `git diff` for the code.
7. Walk through section 5 (the `.vscode` finding).

To show the vulnerable version live: `git stash push -u -- server/src client/src` (nodemon and Vite reload), repeat steps 3-4, then `git stash pop` to restore the fix.
