# Flow — Simulating the CSRF and DoS Attacks

This project includes a **Maintenance Requests** feature (`/maintenance`). Any logged-in
resident can file a request to fix something in a room. The feature is protected against:

1. **CSRF (Cross-Site Request Forgery).** State-changing requests require a session-bound
   anti-CSRF token in the `x-csrf-token` header, in addition to the httpOnly auth cookie.
2. **DoS (Denial of Service).** Maintenance routes are rate-limited per client; excess
   requests receive `429 Too Many Requests`.

Follow the steps to confirm both attacks are now rejected, then read *Why the protections
work* and run the tests.

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
CSRF_SECRET=<a separate long random string>
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
   The client first fetches a CSRF token and sends it with the write request.

**Leave this browser logged in.** The attack simulations rely on the victim's active session.

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

## 3. Spring the CSRF trap

In the **same browser** where you are logged in as the victim, open:

```
http://localhost:1337
```

It looks like a harmless "You won a prize!" page. But on load it **auto-submits a hidden
form** that POSTs to `http://localhost:4000/api/maintenance` with a forged request
(`description=Forged by attacker via CSRF`), targeting a hidden iframe so you see nothing.

The forged form does not include the `x-csrf-token` header. The API rejects it with **403**.
Go back to the app tab and refresh Maintenance to confirm the forged request was not filed.

> Want to watch the rejection? Open DevTools → **Network** on the attacker page before it
> loads. The cross-site `POST` to `/api/maintenance` carries the auth cookie but lacks a valid
> CSRF token, so it returns **403**.

---

## 4. Spring the DoS flood

Still on `http://localhost:1337`, click **"Claim my prize"**. The page fires **hundreds of
`fetch` requests** at `http://localhost:4000/api/maintenance` straight from the victim's
browser.

Open DevTools → **Network** and watch: requests initially succeed, then the maintenance
rate limiter refuses excess requests with **429 Too Many Requests**.

---

## 5. Why the protections work

**CSRF**

1. **The auth cookie is still sent automatically** — `server/src/middleware/auth.js` reads the
   JWT from `req.cookies.token`. The attacker may cause a browser request to carry it, but the
   request is not accepted without a valid CSRF token.
2. **The token is session-bound** — `GET /api/csrf-token` uses `csrf-csrf` to issue the token
   in a response body and an httpOnly cookie. The client returns the token in a header; a
   cross-site HTML form cannot set that header or read the token.
3. **CORS does not save you by itself.** CORS only blocks the attacker from *reading* the
   response; the browser still *sends* the request and the server still *acts on it*. CSRF is
   about the write succeeding, not about reading the reply. The CSRF token supplies the
   missing proof of intent.

> ### Why `SameSite` doesn't save you here
> The auth cookie is `SameSite=Lax`. You might expect that to block a cross-site POST — and
> across true different sites (`evil.com` → `yourbank.com`) it largely would. But the attacker
> page (`localhost:1337`) and the API (`localhost:4000`) are the **same site**: the port is not
> part of a site's identity, only the registrable domain is. So the cookie is sent. This is a
> deliberate lesson: **`SameSite` is a useful layer but not a substitute for a real anti-CSRF
> token.**

**DoS**

`express-rate-limit` limits maintenance requests to 30 per client per minute. Requests above
the cap are rejected with `429` before reaching the maintenance controller.

Login and registration are exempt because no authenticated session exists yet; safe methods
(`GET`, `HEAD`, `OPTIONS`) do not change state and are also exempt.

---

## 6. Running the tests locally

A test suite ships with the project. Run it from the **project root**:

```bash
npm install     # first time only
npm test
```

Expected behavior:

- A forged request without a CSRF token is rejected (`403`); no data is written.
- Repeated requests from one client are throttled (`429`).
- The client attaches the CSRF token to mutating requests.

Notes:

- The server tests spin up an **in-memory MongoDB** via `mongodb-memory-server`. The first run
  downloads a small `mongod` binary, so you need **internet access the first time** (cached after).
- You need **Node.js 18+ (20 recommended)**.
- The same `npm test` works on **Windows, macOS, and Linux**.
