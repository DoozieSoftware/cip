# Civic Intelligence Platform

A production-grade, AI-assisted civic issue reporting platform.

## Quickstart

```bash
# 1. Clone and enter
cd civic-platform

# 2. Bring up the full stack (MySQL, Redis, MinIO, Laravel, Nginx, queue, scheduler)
docker compose up -d

# 3. Run migrations + seeds
docker compose exec php php artisan migrate --seed

# 4. Open the API
curl http://localhost/api/v1/health

# 5. Open the API documentation
open http://localhost/api/documentation
```

## Architecture

- **Backend:** Laravel 12, PHP 8.4, MySQL 8.4 LTS, Redis, MinIO
- **Frontend:** React 19, TypeScript, Vite, Tailwind v4
- **AI:** Configurable provider abstraction; Qwen-VL default
- **Modules:** Each domain lives in `backend/app/Modules/<Name>/` with controllers, services, policies, events, jobs, requests, resources, tests.

See:
- [`docs/`](./docs) — full specification
- [`.codex/roadmap.md`](./.codex/roadmap.md) — implementation roadmap
- [`.codex/task_queue.md`](./.codex/task_queue.md) — atomic task queue
- [`.codex/current_milestone.md`](./.codex/current_milestone.md) — active milestone
- [`.codex/completed_tasks.md`](./.codex/completed_tasks.md) — implementation log

## Development

```bash
# Backend tests
cd backend && composer test

# Frontend tests
cd frontend && npm test

# Static analysis
cd backend && vendor/bin/phpstan analyse --level=max
cd frontend && npm run lint
```

## License

Proprietary. © Doozie Software Solutions.
