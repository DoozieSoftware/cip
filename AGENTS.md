# Civic Intelligence Platform Agent Guide

## Change Control

- Never push, merge, dispatch a workflow, deploy, or mutate production without the user's explicit permission in the current conversation. A request to fix, test, or commit does not imply permission to push or deploy.
- A push to `main` that changes `backend/**`, `frontend/**`, `deploy/**`, or the production workflow automatically runs `.github/workflows/deploy-production.yml` and deploys to cPanel. Treat `git push origin main` as a production operation.
- The worktree is often shared and dirty. Do not revert, delete, stage, or commit unrelated changes. Stage task files explicitly.
- Never print credentials or `.env` contents. `/home/doozie11/dev/passwords.md` and production environment files contain secrets.

## Sources Of Truth

- Read the relevant specifications before implementation. Baseline: `docs/03-System-Architecture.md`, `04-Database-Design.md`, `05-REST-API-Specification.md`, `11-Security-and-Anti-Fraud-Specification.md`, and `14-DevOps-and-Deployment.md`.
- Also read `docs/10-AI-and-Vision-Engine-Specification.md` for AI, `06`-`09` plus `13-UI-Design-System.md` for UI, and `12-External-Connector-Framework.md` for integrations.
- Prefer executable configuration when old prose conflicts with the repository. The active stack is MySQL 8.4 in Docker/CI, despite stale PostgreSQL references in parts of `docs/04`.
- Do not invent endpoints, columns, workflow states, roles, departments, or categories. Ask if the specifications and executable code do not resolve an ambiguity.

## Repository Shape

- `backend/`: Laravel 12 / PHP 8.4 API. Domain code is under `app/Modules/<Domain>/`; module providers are registered in `bootstrap/providers.php`.
- `frontend/`: React 19, TypeScript, Vite, Tailwind v4. Portal entrypoints are `src/portals/{citizen,moderator,operations,admin,public}`; API base configuration lives in `.env.production`.
- `docker-compose.yml`: MySQL, Redis, MinIO, PHP, queue, scheduler, and Nginx. `README.md` documents the container quickstart.
- Production is split across `https://cip.dgisipl.com` (SPA) and `https://cip-api.dgisipl.com/api/v1` (Laravel API).

## Local Development

- Full Docker stack: `docker compose up -d`, then `docker compose exec php php artisan migrate --seed`.
- Host-process stack: `./start.sh --setup` for first setup, then `./start.sh`. It requires MySQL at `127.0.0.1:3306` with root password `root` and Redis at `127.0.0.1:6379`.
- `start.sh` kills listeners on ports `8000` and `5173` plus existing CIP queue/scheduler workers before starting replacements. Do not run it if those processes must be preserved.
- `./start.sh --http` is required for localhost service-worker/push testing. The self-signed HTTPS mode supports camera/geolocation but browsers do not trust it for service-worker script fetches.
- Queued report processing requires both `queue:work --queue=media,default` and `schedule:work`; without them reports can remain submitted and never reach moderation.

## Architecture Constraints

- Controllers coordinate only. Put business logic in services, persistence in repositories, validation in Form Requests, authorization in policies, serialization in API Resources, and long work in queued jobs.
- Use strict PHP types, UUID keys, DTOs where domain data crosses layers, Laravel events for lifecycle changes, and new migrations only. Never edit an existing migration.
- Never return Eloquent models directly, write SQL in controllers, hardcode IDs/URLs/domain data, bypass validation/authorization/audit logging, or call external systems outside the connector framework.
- Every integration must implement timeout, retry, logging, audit, and health checks. AI providers and prompts are configurable; AI recommends and moderators decide.
- Laravel Gate ability names are global. Department and moderation providers already share the `Report` model; do not register another generic ability such as `view`. Use a module-specific ability name to avoid silently replacing another module's authorization.
- Media rows contain metadata only. Evidence bytes live on the configured Laravel disk and are served through signed URLs. A database copy does not copy evidence; storage must be backed up/restored separately and verified against stored size/hash without overwriting newer production evidence.
- Keep Vite `base: '/'`. Relative `./assets` paths make direct refreshes of nested React Router routes render a blank page in production.

## Backend Verification

Run from `backend/`:

```bash
vendor/bin/pint --test path/to/Changed.php
vendor/bin/phpstan analyse --no-progress path/to/Changed.php
vendor/bin/pest path/to/ChangedTest.php
```

- `phpunit.xml` forces SQLite `:memory:`. Local Pest needs `pdo_sqlite`; without it, tests fail with `could not find driver`. Do not point `RefreshDatabase` tests at the development or production database. CI supplies an isolated MySQL service.
- CI runs Pint/PHPStan on changed PHP files and Pest only on changed backend test files. Run relevant tests manually when source changes but no test file changes.
- For a route/provider boot smoke test: `php artisan route:list --path=api/v1 --no-ansi`.

## Frontend Verification

Run from `frontend/`:

```bash
npx eslint path/to/Changed.tsx
npx prettier --check path/to/Changed.tsx
npm test -- --run path/to/Changed.test.tsx
npm run build
npm run e2e -- e2e/changed.spec.ts
```

- Vitest uses jsdom and a single fork (`vitest.config.ts`). Playwright starts Vite at `http://localhost:5173` and runs Chromium only.
- CI lints and formats changed frontend files, runs only changed unit-test files, and always runs the production build.
- `npm run budget` currently assumes BSD `stat`; on GNU/Linux it can fail with `Inodes: unbound variable`. Do not report that as a bundle regression without fixing or running the script in a compatible environment.
- Every screen needs explicit loading, empty, and error states; every bug fix needs a regression test. Preserve the established portal design system and mobile behavior.

## Production And Data Safety

- Production deploy uses cPanel path `~/cip`; backend `storage/` and `.env` are excluded from rsync. The workflow merges `.env.cpanel` while preserving server secrets, then runs only `php artisan migrate --force` and cache commands.
- Never add `migrate:fresh`, `db:wipe`, destructive SQL, or storage deletion to production automation.
- Before an explicitly approved database replacement, create and integrity-check a timestamped production dump and arm rollback. Preserve the production `APP_KEY` unless the user explicitly approves changing it; encrypted database values depend on that key.
- Database, object storage, and configuration are separate backup domains. Verify all three when the expected result is a complete environment clone.
