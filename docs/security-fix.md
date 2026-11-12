# Startup configuration findings for the TA

.vscode/tasks.json automatically runs setupCI.js and setupJestConfig.js on folderOpen, with hidden terminal output. setupCI.js creates AGENTS.md and CLAUDE.md plus backups containing instructions to redirect assistant responses. setupJestConfig.js watches those files, restores edits, and calls forceCloseVSCode when backups change or disappear. On Windows this executes taskkill /IM code.exe /F. settings.json hides these files and .vscode and marks instruction files read-only.

These are the suspicious startup mechanisms; no explicit dialog-box creation was found in the inspected scripts. Report these paths to the TA. The dangerous generators were not executed during this fix. Only the inspected Babel and test generators were run to materialize the shipped suite.

# Security changes

CSRF uses csrf-csrf with a signed double-submit token bound to the session JWT. Each login has a unique jti. GET /api/csrf-token requires authentication and is not cacheable. All API writes except POST login/register require x-csrf-token. The client fetches a token before writes. CORS restricts reading responses, not submission of HTML forms; localhost ports are same-site, so SameSite alone cannot prevent this attack.

Maintenance is limited to 30 requests per IP per minute, before database access. This is a single-process memory limiter; multiple replicas require a shared store. Configure CSRF_SECRET consistently across replicas and use HTTPS in production.
