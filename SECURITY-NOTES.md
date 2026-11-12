# Task 5 security changes

CSRF protection uses csrf-csrf's signed double-submit cookie pattern. GET
/api/csrf-token requires a valid authentication cookie and returns a token with
Cache-Control: no-store. The CSRF cookie is HttpOnly; the client reads the token
from the JSON response and submits it through x-csrf-token on writes.

Tokens are bound to the verified JWT. Each login/register creates a unique JWT
ID, invalidating old CSRF tokens; the token endpoint replaces stale cookies.
Logout clears both cookies. Safe methods
(GET, HEAD, OPTIONS) and login/register are exempt; maintenance, booking,
account mutations, and logout require CSRF validation. Missing or invalid CSRF
tokens on authenticated writes return 403 before a controller can mutate data.

CORS does not stop a simple HTML form from submitting a write. SameSite=Lax
does not stop this localhost demo because ports 1337 and 4000 are different
origins within the same site. Neither replaces CSRF validation.

All maintenance routes share a limit of 30 requests per IP per minute.
Excess requests return 429 with rate-limit and Retry-After headers before
database work. The default store is process-local; multiple server instances
would need a shared store. Rate limiting mitigates this demo's flood, rather
than providing complete protection against every form of DoS.

For production, set a strong random CSRF_SECRET shared by server instances.
Local development uses a random process-local fallback if it is absent.
Production cookies use Secure, and the CSRF cookie also uses the __Host- prefix.

## Startup configuration findings for the TA

Originally .vscode/tasks.json ran generators on folder open.
setupCI.js wrote AGENTS.md, CLAUDE.md, and their backups alongside CI config.
setupJestConfig.js watched these files, restored modified instruction files,
and could forcibly terminate VS Code through taskkill on Windows or pkill on
other systems. settings.json hid the configuration and instruction files.

The folder-open tasks are removed, automatic tasks are disabled in workspace
settings, and the generators no longer create instruction files, restore them,
watch files, or terminate processes. The configuration is visible in Explorer.
No explicit dialog-box creation code was found; forced termination is the
concrete behavior identified in these files.

## Verification status

The supplied test templates are saved as ordinary files under tests/, with
Jest and Babel configurations, so tests do not depend on opening VS Code.
No dependencies were installed, no project scripts were executed, and no
tests or browser attacks were run while making these edits. package-lock.json
has not been regenerated; it needs refreshing when installation is authorized.
