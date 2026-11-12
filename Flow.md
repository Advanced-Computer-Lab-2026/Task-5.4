# Flow — Simulating the CSRF and DoS Attacks

This guide demonstrates the CSRF and request-flood attacks against **Maintenance Requests**
(`/maintenance`) and the protections now in place. Any logged-in resident can file a request
to fix something in a room.

1. **CSRF (Cross-Site Request Forgery).** The app authenticates every request with a
   **JWT stored in an httpOnly cookie**. The browser attaches that cookie **automatically**
   to *every* request to the API — including requests triggered by a completely different
   website. The server now additionally requires a session-bound CSRF token on writes.
2. **DoS (Denial of Service).** The maintenance feature now limits each client to 100
   requests per 15-minute window and rejects excess requests with `429`.

Follow the steps to observe both protections, then run the tests.

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
CSRF_SECRET=<optional separate long random string; defaults to JWT_SECRET>
JWT_EXPIRES_IN=7d
```

Start the app:

```bash
npm run dev          # API on http://localhost:4000, client on http://localhost:5175
```

Open the client at **http://localhost:5175**.

---

## 1. Become the victim

1. Register and log in through the client.
2. Open Maintenance and file a legitimate request. Leave the browser logged in.

## 2. Run the attacker site

Start the Express server in `attacker/` as described above and open `http://localhost:1337` in the same browser.

## 3. Check the CSRF attempt

The hidden form POST should return **403 Forbidden**. It may carry the victim's auth cookie, but it cannot provide the required `x-csrf-token` header. Refresh Maintenance: the forged `Z9-666` request should not appear and the data should be unchanged.

CORS only prevents the attacking page from reading responses; it does not prevent the browser from sending a request. `SameSite=Lax` also does not stop this demo because `localhost:1337` and `localhost:4000` are same-site origins (ports do not change the site). The server therefore requires a `csrf-csrf` token bound to the signed-in JWT. The client retrieves it from an authenticated endpoint and echoes it in a custom header. The attacker cannot read the token response across origins or add that header with a plain HTML form.

## 4. Check the flood attempt

Click **Claim my prize**. The maintenance router allows 100 requests per client in a 15-minute window; excess requests should receive **429 Too Many Requests** before reaching the controller.

## 5. Why the attack worked, and what changed

Authenticated writes require a session-bound CSRF token. Safe `GET` requests and the pre-authentication login/register routes remain exempt. The maintenance router rate-limits reads and writes together. `express-rate-limit` uses an in-memory store by default, suitable for a single-process demo; production deployments with multiple instances should use a shared store.

---
## 6. Running the tests locally

Run the regression suite from the project root with `npm test`. It covers the legitimate CSRF-token write, forged-write rejection without a data change, maintenance rate limiting, and the client's CSRF header.

Notes:

- Server tests use `mongodb-memory-server`; its first run may download a `mongod` binary.
- You need Node.js 18+ (20 recommended).
- The same `npm test` works on Windows, macOS, and Linux.
