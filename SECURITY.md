# Security notes (plain language)

This document explains the main security choices for this project and how to operate the service safely.

## What we protect against

- SSRF (Server-Side Request Forgery): attackers asking this server to fetch internal or private addresses (for example: `http://127.0.0.1`, cloud metadata endpoints like `169.254.169.254`, or local admin panels). Those requests can leak secrets or reach services the attacker can't access directly.
- Abuse / spam / DoS: too many requests or long-running requests that overload the server.

## What we implemented

- SSRF protection: the server checks every URL submitted for tests and blocks any target that is a loopback/private IP address (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, link-local ranges). If a hostname resolves to a private IP the request is refused.
- Fail-closed on DNS errors: by default, if a hostname cannot be resolved the server treats it as suspicious and rejects the test. This avoids opening a gap where DNS failures could be exploited.
- API key for mutating endpoints: POST/PUT/PATCH/DELETE requests under `/api` require an `X-API-KEY` header that matches `ADMIN_API_KEY` in the environment (if configured). This prevents anonymous callers from creating jobs.
- Rate limiting: basic rate limiting is applied to `/api` endpoints (configurable via environment variables) to reduce spam and DoS risk.
- Report cleanup: completed reports are persisted to `reports/` and a scheduler deletes old reports after a configurable TTL.

## Important environment variables

- `ADMIN_API_KEY` — when set, write operations require `X-API-KEY`. Keep this secret and do not commit it to the repo.
- `SSRF_ALLOW_UNRESOLVED` — defaults to `false`. Set to `true` only for local development if DNS is flaky. In production leave it unset or `false` so unresolved hosts are blocked.
- `SSRF_DEBUG` — optional. When `true` the SSRF helper prints hostname resolution details to the server log (useful only for debugging; turn off in production).
- `REPORT_TTL_DAYS` — how many days to keep persisted reports (default: 7).
- `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` — control rate limit window and number of requests allowed in that window.

## Operational recommendations (do these)

1. Do not commit secrets (like `ADMIN_API_KEY`) to git. Use `.env` locally or a secret manager in production.
2. Keep `SSRF_ALLOW_UNRESOLVED` off in production.
3. Turn off `SSRF_DEBUG` in production logs to avoid leaking resolution details.
4. Protect the repository branch with required status checks (enable the CI workflow we added) so PRs run tests before merge.
5. Consider adding an allowlist for trusted domains if you need to permit internal targets for specific runs.
6. If you expect heavy usage, run the worker in an environment with a durable queue (Redis) and add per-key quotas.

## If you find a security issue

Please open an issue in this repository marked `security` or email the project maintainer with details. Do not post sensitive details publicly.
