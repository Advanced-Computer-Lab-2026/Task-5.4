# Task 5 (Variant): Dorm Room Booking — With Maintenance Requests

## Implemented security changes — start here

The original assignment below describes the vulnerable starting point. This copy
now implements CSRF protection and maintenance rate limiting. The original six
tests are retained without additional regression cases, and the client
production build passes.

### Setup

Copy `server/.env.example` to `server/.env`. Use your own local MongoDB or database
connection and set **two different random secrets**, one for `JWT_SECRET` and one
for `CSRF_SECRET`. Run this command twice to generate them:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Then run `npm install`, `npm test -- --runInBand`, and `npm run dev`.
Tests use a temporary MongoDB database; they do not use your configured database.
The installed MongoDB test tooling needs Node 20.19+; Node 24 was used here.
Set `NODE_ENV=production` only when serving over HTTPS: production cookies use
the `Secure` flag. `CLIENT_ORIGIN` defaults to `http://localhost:5175`.

The previous README contained database credentials and a JWT signing secret.
These examples have been replaced. Their owner must rotate the published values;
removing text does not revoke credentials or erase Git history.

### What changed, in simple words

**CSRF: somebody tricks your browser into doing something you did not ask for.**
Your login cookie is like a dorm ID card. Your browser automatically shows that
card when sending requests to the dorm website. The attacker page used that
automatic behavior to submit a fake maintenance request in your name.

Now a write also needs a special CSRF ticket:

1. You log in or register. The server sets an HttpOnly login cookie, containing a
   signed JWT. A fresh random `jti` makes each login session unique.
2. Before a write, `client/src/api.js` requests `GET /api/csrf-token` using that
   cookie. The server first checks that you are logged in.
3. `server/src/middleware/csrf.js` uses `csrf-csrf` to create a random,
   cryptographically signed token bound to that exact login JWT. It sends the
   token in a cookie and in the JSON response. The response cannot be cached.
4. The client explicitly copies the JSON token into the `x-csrf-token` header.
   It does not read the HttpOnly cookie. Concurrent writes share one token fetch;
   later writes fetch again so an old cached token does not survive a new login.
5. Before a write reaches a controller, the server verifies authentication,
   matching cookie/header values, and the token's cryptographic signature for
   this session. A missing, guessed, or different-session token gets **403**.

The attacker form can bring the ID card automatically, but cannot read the
secret ticket from our API response. A plain HTML form also cannot add our custom
header. Having only the cookie is therefore insufficient.

This protects writes to maintenance, bookings, users, and logout. GET, HEAD, and
OPTIONS are exempt because they do not change application records. Only POST
login/register are exempt among writes, as required by the assignment. Logout
clears both cookies. The token is not a replacement for ownership checks: another
resident still cannot edit or delete your request even with their own valid token.

**Why CORS alone did not fix it:** CORS controls which origins may read API
responses and gates certain requests through preflight. A simple HTML form can
still send a request. Blocking someone from reading the reply does not undo a
database write. Here CORS helps keep the CSRF-token response unreadable to the
attacker; server-side token validation rejects the forged write.

**Why SameSite alone did not fix it:** `localhost:1337` and `localhost:4000` have
different origins but the same site. Different ports do not make different sites,
so the Lax cookie can accompany this demo's attack. We keep SameSite as another
layer of protection.

**DoS: somebody makes so much work that other people cannot get served.**
Imagine one resident asking the receptionist 300 questions at once. Previously,
every maintenance request reached the database. Now `express-rate-limit` gives
each IP address **30 maintenance requests per 60-second window**. Reads and writes
share this budget. Excess requests receive **429 Too Many Requests**, with a
`Retry-After` header, before body parsing, authentication, or database work.
`server/src/middleware/rateLimit.js` defines this budget; `app.js` installs it.

Other changes: `index.js` loads environment settings before importing the app and
requires both secrets at startup. Auth cookies use Secure in production. The
booking-edit form now reads `response.data.booking`, matching the API response;
its existing TODOs for inputs and saving were already implemented.

### CIA, in very small words

| Letter | Meaning | Dorm example | What this project does |
| --- | --- | --- | --- |
| C | Confidentiality: keep private things private | Other residents cannot read your password | Existing bcrypt password hashing and HttpOnly login cookies help; production HTTPS is still required. CSRF is not data encryption. |
| I | Integrity: only allowed changes happen | Nobody submits a fake repair request in your name | New CSRF checks reject forged writes; existing ownership checks restrict whose records you can edit. |
| A | Availability: the service stays usable | One noisy person should not occupy the receptionist forever | New maintenance rate limits refuse excess work with 429. |

Banana version: **C = nobody peeks at private bananas. I = nobody secretly swaps
your bananas. A = you can reach the banana stand when you need it.**

We improved I and A; we have not "solved all security." Public endpoints still
expose names/emails and maintenance data, as in the original assignment. Privacy
would require a separate access-control change. An in-memory limiter applies to
one server process, resets on restart, and shares a budget among people behind
the same IP. Multiple servers need a shared store and carefully configured proxy
trust; large distributed attacks need upstream protection. Login/register remain
CSRF-exempt and are not rate-limited by this maintenance limiter. JWT logout
clears the browser cookie but does not revoke a previously stolen JWT.

Dependency checks are not completely clean: `npm audit --omit=dev` reports two
moderate dependency entries for React Router; npm proposes a major-version
upgrade. The full install audit reports 24 entries including development tools
(2 low, 21 moderate, 1 high). These were not force-upgraded as part of the CSRF/DoS
assignment; a separate dependency upgrade and compatibility check is still needed.

### Editor startup investigation / information for your TA

The original `.vscode/tasks.json` ran six tasks on `folderOpen`, with their
terminals hidden. `Generate Jest Config` started `.vscode/setupJestConfig.js`,
which stayed running as a file watcher. It restored edited `AGENTS.md` and
`CLAUDE.md` from backups. Changing the backups could call `forceCloseVSCode()`,
which executed `taskkill /IM code.exe /F` on Windows or `pkill` on macOS/Linux.
This could close the editor and lose unsaved work. `.vscode/setupCI.js` generated
the instruction files/backups, and `.vscode/settings.json` hid these files and
made the instruction files read-only in the editor.

The identified watcher process was stopped. The watcher, forced-close code, and
instruction-file generation were removed. Tasks now run manually; automatic
tasks are disabled and those files are visible. The harmless config generators
remain available. No explicit popup/dialog creation code was found, so the
watcher is a confirmed editor-disruption mechanism, not a verified explanation
of a particular unseen dialog. Share this finding with your TA; no message has
been sent on your behalf.

### Verification

Run `npm test -- --runInBand` and `npm run build --workspace client`.
The original six tests cover legitimate maintenance creation, rejection of a
forged request without adding it to the database, normal public reads, flood
throttling, client credentials, and client CSRF-header attachment.
Browser replay could not be completed because the browser
automation connection was unavailable. Use the updated `Flow.md` expectations
for a manual browser check.

Implementation references: [csrf-csrf documentation](https://github.com/Psifi-Solutions/csrf-csrf)
and [express-rate-limit documentation](https://express-rate-limit.mintlify.app/overview).

---

We are building on top of the Dorm Room Booking variant from Task 3. Previously we
implemented `JWT` authentication; now the session is stored in a cookie and a new
**maintenance requests** feature has been added. Let us first start with some context.

## Context

### Cross-Site Request Forgery (CSRF)

A `CSRF` attack is a security vulnerability where a malicious website causes a victim's browser
to send a **state-changing request to an application the victim is already logged into** —
without the victim's knowledge or consent. The attacker never sees the victim's password or
session token; they simply abuse the fact that the browser **automatically attaches the victim's
credentials** (most commonly a session cookie) to every request bound for that application,
whoever triggered it.

Unlike injection or `XSS`, the attacker runs **no code inside the target's origin**. They do not
read any of the victim's data either — a CSRF attack is "blind." It only needs the victim's
request to *succeed*, riding on their ambient, authenticated session. That is why any sensitive,
state-changing endpoint authenticated only by a cookie is a target.

#### How it works:

1. **An authenticated session in a cookie**: The victim logs into the application. The server
   hands the browser a session cookie, which the browser stores and then sends on **every**
   subsequent request to that site — automatically.
2. **A forged cross-site request**: The victim visits a page the attacker controls (a phishing
   link, a forum post, a malicious ad). That page quietly issues a state-changing request to the
   target application — classically a hidden, **auto-submitting HTML form**.
3. **The browser attaches the cookie**: Because the request is bound for the target site, the
   browser attaches the victim's session cookie. The server sees a valid session and executes the
   request **as if the victim intended it** — changing data on their behalf.

### Denial of Service (DoS)

A `DoS` attack is a security vulnerability where an attacker makes an application slow or
unavailable to its legitimate users by overwhelming it with more work than it can handle. There
is no session to hijack and nothing is changed on anyone's behalf; the goal is simply to exhaust
a finite resource — CPU, memory, database connections, network bandwidth — by sending far more
requests, or far more expensive requests, than the server was provisioned for.

The attacker needs **no credentials and reads no data**; they only need the requests to keep
arriving. Any endpoint that does real work on every call — a database query, a file read, a hash
computation — and places **no limit on how often one client may call it** is a target. The
simplest form is a flood: a single client (or a crowd of them) hammers the endpoint as fast as it
can.

#### How it works:

1. **An endpoint that does work and has no limit**: The server exposes a route that runs a query
   (or other real work) on every call, and never caps how many calls one client may make in a
   given window.
2. **A flood of requests**: The attacker fires hundreds or thousands of requests in a short burst
   — from a script, or even from JavaScript on a webpage running in the browsers of many lured
   visitors.
3. **The server tries to serve them all**: With nothing to refuse the excess, every request
   competes for the same CPU, memory and database connections. Legitimate users' requests queue
   behind the flood and time out — the service is effectively down.

## Running it

```bash
npm install           # Install concurrently and the dependencies of the projects
npm run install:all   # For safety
npm run dev           # API on :4000, client on :5175
```

Create the `server/.env` file.

```ini
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/dorm-booking
JWT_SECRET=<generate-a-random-secret>
CSRF_SECRET=<generate-a-different-random-secret>
JWT_EXPIRES_IN=7d
```

## What was added on top of Task 3

<details>
<summary> View details </summary>

### Server

- **Auth moved from the `Authorization` header to a cookie.** Instead of returning the `JWT` in
  the response body for the client to keep in `localStorage`, `login`/`register` now set it in an
  **httpOnly cookie** (`authController.js`), and `middleware/auth.js` reads the token from
  `req.cookies.token`. A `POST /api/auth/logout` route clears the cookie. The browser now sends
  the session automatically on every request — which is exactly the precondition for `CSRF`.
- `app.js` now mounts `cookie-parser`, `express.urlencoded` (so plain HTML-form bodies are
  parsed), and CORS with `credentials: true` locked to the client origin.
- Added a new model called **`MaintenanceRequest`** with the attributes: `roomNumber`, `category`,
  `description`, `status`, `author`.
- Added the **Maintenance controller** with the following routes:
    - `GET /api/maintenance`: returns all maintenance requests (public).
    - `GET /api/maintenance/:id`: returns a single maintenance request (public).
    - `POST /api/maintenance`: files a new maintenance request for the logged-in user. Filing a
      request is a sensitive, state-changing action done in the user's name.
    - `PATCH /api/maintenance/:id`, `DELETE /api/maintenance/:id`: update or delete your own
      request (others' requests return `403`).

### Client

- `api.js` now sends requests with `withCredentials: true` (so the auth cookie rides along) and no
  longer stores a token in `localStorage`. `AuthContext` restores the session via
  `GET /api/auth/me`.
- Added the **`Maintenance.jsx`** page (and a **Maintenance** nav link) for viewing and filing
  maintenance requests.

</details>

## Simulating the Attack

For this you will **not** need Postman — a `CSRF` attack is carried out by a webpage, not a crafted
API client. The `attacker/` folder is a small, separate Express server that plays the role of a
malicious site the victim visits. Look through the `Flow.md` Markdown file for the detailed steps
to simulate both attacks (register a victim, run the attacker server, open its link, and watch a
maintenance request get silently filed in the victim's name — then click through and watch the same
page flood the API with requests).

Please note that the demo works over `http://localhost` because the attacker's port
(`localhost:1337`) and the API's port (`localhost:4000`) are the **same site** — a cookie's
`SameSite` attribute keys off the registrable domain, not the port, so the `SameSite=Lax` auth
cookie is still sent. This is a deliberate lesson: `SameSite` is a useful layer but **not** a
complete defense, which is why a real anti-`CSRF` token is required (details in the `Flow.md`
file). After reading the file, read the next section.

## Task

<details>

<summary>View Task</summary>

The attack in the `Flow.md` file works for two independent reasons.

First, the write endpoint `POST /api/maintenance` (`maintenanceController.js` +
`routes/maintenance.js`) trusts the session cookie **alone**: there is no proof the request
actually originated from our own app — no anti-`CSRF` token, no check of intent. Since the browser
attaches that cookie to any cross-site request, any page the victim visits can forge a request in
their name.

Second, none of the maintenance endpoints place **any limit on how often one client may call
them**, so the attacker's page can flood `GET /api/maintenance` with unlimited requests and
exhaust the server — a `DoS`.

**Fix both.** Make the maintenance feature safe while keeping its legitimate behavior, then re-run
the attacks in `Flow.md` and confirm they now fail (the forged request should return `403` and
leave the data unchanged, and the flood should be refused with `429`).

- **CSRF:** issue a secret, per-session **CSRF token** that the attacker's site cannot read or
  guess; require that token on every state-changing request; leave "safe" `GET` requests and the
  pre-auth routes (login/register, which run before a session exists) exempt; and echo the token
  from the client on each write. Use the **`csrf-csrf`** package (the double-submit-cookie pattern;
  the old `csurf` is deprecated). You are expected to understand **why** `CORS` and `SameSite`
  cookies do not by themselves close this hole, and to think carefully about which requests need
  protection and which must stay exempt.
- **DoS:** throttle the feature so one client cannot flood it. Use the **`express-rate-limit`**
  package to return `429 Too Many Requests` once a client exceeds a sensible limit in a time
  window.

A test suite ships with the project. Run it from the project root:

```bash
npm install     # first time only
npm test
```

The `CSRF` and `DoS` tests describe the **secure** behavior and are **expected to FAIL** in this
project (the suite is red). Your job is to make them green by applying the fix.

### Custom Configurations

Sometimes when working in teams, the team may have custom configurations (like automatic tasks) that run immediately after booting up VSCode. The reason these automatic tasks run on startup is because of a folder called `.vscode`; this folder store custom configurations for VSCode and it is normally present on the C-Drive, assuming a Windows user. However, that folder can also be present in project directories, like the one you are currently using. Before cloning any GitHub Repository that has automatic takes or custom configurations in general you should always verify these configurations before cloning, since they might contain malicious code that targets your machine. For example, I could have a backdoor open that periodically queries my server, attacker server, and I could, at any point, send a command that shuts down your PC, among other options. The second part of this task for you is to find the piece of code that is creating the dialog box issue and inform your TA afterwards.

</details>
