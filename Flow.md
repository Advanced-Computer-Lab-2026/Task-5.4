# Flow — Simulating the CSRF and DoS Attacks

This project includes a **Maintenance Requests** feature (`/maintenance`). Any logged-in
resident can file a request to fix something in a room. This flow verifies defenses against
CSRF and request flooding:

1. **CSRF (Cross-Site Request Forgery).** The app authenticates every request with a
   **JWT stored in an httpOnly cookie**. The browser attaches that cookie **automatically**
   to *every* request to the API — including requests triggered by a completely different
   website, so state-changing requests also require a session-bound CSRF token that an attacker
   page cannot read or guess.
2. **DoS (Denial of Service).** Maintenance endpoints are rate-limited so one client cannot
   make unlimited requests in a short time.

Follow the steps to verify both protections, then read *Why it works*, then run the tests.

---

## 0. Prerequisites & setup

From the **project root** (`Task-5.4/`):

```bash
npm install          # installs server + client (npm workspaces) + test tooling
```

Create `server/.env` (if missing):

```
PORT=4000
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d
CSRF_SECRET=<a different long random string>
```

Start the app:

```bash
npm run dev          # API on http://localhost:4000, client on http://localhost:5175
```

Open the client at **http://localhost:5175**.

---

## 1. Become the victim

1. Click **Register** and create a user (e.g. `victim@test.dev` / `secret123`).
2. You are now logged in. Open DevTools → **Application → Cookies → http://localhost:4000**
   and note the `token` cookie. It is **HttpOnly** (JavaScript cannot read it) — but the
   browser still sends it on every request to the API.
3. Click **Maintenance** and file a request (e.g. room `B2-104`, *plumbing*, "Leaking tap").

**Leave this browser logged in.** The demo attempts both attacks against the active session.

---

## 2. Run the attacker site

The `attacker/` folder is a tiny, separate Express server that plays the role of "some random
site the victim visits" (a phishing link, a forum post, an ad iframe…).

In a **second terminal**:

```bash
cd attacker
npm install
npm start            # Attacker site on http://localhost:1337
```

---

## 3. Verify the CSRF protection

In the **same browser** where you are logged in as the victim, open:

```
http://localhost:1337
```

It looks like a harmless "You won a prize!" page. On load it auto-submits a hidden form that
attempts to POST a forged maintenance request, targeting a hidden iframe.

The POST should be rejected with `403` because the form cannot provide the session's CSRF token.
Go back to the app and refresh Maintenance: no request for room `Z9-666` should appear.

In DevTools → **Network**, verify that the POST is refused and does not create a request. CORS
only controls whether an origin may read a response; it does not prevent the browser from sending
the form. The anti-CSRF token is the proof the server checks.

---

## 4. Spring the DoS flood

Still on `http://localhost:1337`, click **"Claim my prize"**. The page fires many `fetch` requests
at `http://localhost:4000/api/maintenance` from the victim's browser.

Open DevTools → **Network** and verify that early requests return `200`, then excess requests
return `429 Too Many Requests`.

---

## 5. Why the protections work

**CSRF**

1. **Auth is a cookie the browser sends automatically** — so cookie-authenticated state-changing
   requests need additional proof.
2. **The token is session-bound** — `csrf-csrf` signs it using `CSRF_SECRET` and binds it to the
   auth cookie. The client reads it from the authenticated `/api/csrf-token` response and sends it
   in `x-csrf-token`. An attacker page cannot read that response or set the required header on a
   plain HTML form.
3. **Safe methods and pre-auth routes differ** — `GET`, `HEAD`, and `OPTIONS` are ignored by CSRF
   protection; login and registration are exempt because there is no session yet. All other
   state-changing requests require the token.
4. **CORS does not prevent sending forms.** It only controls whether the attacker can read the
   response. The token check prevents the server from acting on the forged write.

> ### Why `SameSite` doesn't save you here
> The auth cookie is `SameSite=Lax`. You might expect that to block a cross-site POST — and
> across true different sites (`evil.com` → `yourbank.com`) it largely would. But the attacker
> page (`localhost:1337`) and the API (`localhost:4000`) are the **same site**: ports do not
> distinguish sites. The browser may therefore send the `SameSite=Lax` auth cookie with the
> forged request. SameSite is useful defense-in-depth, not a substitute for a CSRF token.

**DoS**

5. **Rate limiting** — `server/src/routes/maintenance.js` applies a per-IP limit to all
   maintenance endpoints, returning `429` after 30 requests in a 15-minute window.

Login and registration remain available before a session exists. Configure a separate,
cryptographically random `CSRF_SECRET`; do not reuse the JWT secret.

---

## 6. Running the tests locally

A test suite ships with the project. Run it from the **project root**:

```bash
npm install     # first time only
npm test
```

The CSRF and DoS tests verify the protected behavior:

- a forged write without a CSRF token is rejected and does not change data;
- repeated requests to maintenance endpoints are throttled with `429`; and
- the client attaches its CSRF token to mutating requests.

The tests should pass once dependencies are installed and `CSRF_SECRET` is configured in the
server environment (the tests set their own value).

Notes:

- The server tests spin up an **in-memory MongoDB** via `mongodb-memory-server`. The first run
  downloads a small `mongod` binary, so you need **internet access the first time** (cached after).
- You need **Node.js 18+ (20 recommended)**.
- The same `npm test` works on **Windows, macOS, and Linux**.
