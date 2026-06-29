# Stakeholder Demo — Status 2026-06-29

## What is ready

**Backend (Laravel 12 / PHP 8.4)** — 100% complete for the demo flow.

| Module | State | Coverage |
| --- | --- | --- |
| Auth (OTP, Sanctum, refresh) | ✅ | 68/68 tests pass |
| Users (CRUD, roles, permissions) | ✅ | 24/24 |
| Departments (CRUD, officers, GIS, exports) | ✅ | covered |
| Reports (submit, photos, video, status) | ✅ | 46/46 |
| Moderation (queue, review, merge, reject, escalate) | ✅ | covered |
| Routing (rules, reassign) | ✅ | covered |
| Workflow (state machine, definitions) | ✅ | covered |
| AI vision (mock + OpenAI-compatible + Qwen) | ✅ | 109 tests |
| Notifications (5 channels, dispatcher, queue) | ✅ | 100 tests |
| Audit log + Security events | ✅ | covered |
| Super Admin (users, roles, perms, report types, security policies, feature flags, audit) | ✅ | 32+ new tests |
| Connector framework | ⏳ | Out of demo scope |
| Production hardening | ⏳ | Out of demo scope |

**Frontend (React 19 / Vite / Tailwind v4)** — 4 portals ready.

| Portal | Pages | State |
| --- | --- | --- |
| Landing + Login | Hero, role quick-switch, OTP form | ✅ Build clean |
| Citizen PWA | Home, Submit, My reports, Report detail, Notifications, Profile | ✅ Build clean |
| Moderator | Dashboard, Queue, Report detail, Duplicates, Fraud, Analytics, AI perf | ✅ Existing (M10) |
| Operations | Dashboard, Reports, Report detail, GIS map, Export, Admin, Analytics, Security, Audit | ✅ Existing (M11) |
| Super Admin | Dashboard, Users, Roles, Report types, Security policies, Feature flags, Audit | ✅ Build clean (this PR) |

## What's missing

- **E2E Playwright on the user machine** (sandbox can't install Chromium)
- **Live geolocation / photo upload testing** (sandbox has no camera, no GPS)
- **Real AI provider integration testing** (sandbox can't reach OpenAI / Qwen endpoints)
- **M14 Connector framework** — deferred, not on the demo path
- **M15/M16 Security + Production hardening** — deferred, not on the demo path
- **Citizen PWA service worker** (offline support) — deferred to v1.1

## Files added / changed this PR

### Backend
- `app/Modules/Authentication/Http/Controllers/AuthController.php` — exposes `debug_otp` in `local` env
- `app/Modules/Authentication/Services/OtpService.php` — in-memory `latestPlain` cache + `latestCodeFor()` getter
- `database/seeders/DemoUsersSeeder.php` — 4 demo accounts (Citizen / Moderator / Dept Officer / Super Admin)
- `database/seeders/DatabaseSeeder.php` — wires in `DemoUsersSeeder`
- `tests/Feature/Authentication/*.php` — 10 files, added `uses(RefreshDatabase::class);` (the existing test code, not the test bodies)

### Frontend
- `src/auth/AuthContext.tsx` — session + role gate
- `src/auth/ProtectedRoute.tsx` — role-aware protected routes
- `src/auth/api.ts` + `src/auth/storage.ts` — Sanctum token storage + API client
- `src/App.tsx` — wires 4 portals + landing + login with role gates
- `src/pages/LandingPage.tsx` — hero with role quick-switch
- `src/pages/LoginPage.tsx` — OTP flow with demo card picker
- `src/portals/citizen/` — full Citizen PWA (6 pages + layout + API client)
- `src/portals/admin/` — full Super Admin SPA (7 pages + layout + API client)

### Top-level
- `DEMO.md` — 124-line stakeholder walkthrough script
- `scripts/verify-demo.sh` — one-shot verification script
- `M12_HANDOFF.md`, `M12_STATUS_2026-06-29.md` — earlier handoff artifacts (now obsolete; see DEMO.md)

## How to run the demo

```bash
cd /Users/akshaydoozie/Documents/doozie/02_client_work/DGISIPL/cip
bash scripts/verify-demo.sh   # confirms everything is wired

docker compose up -d mysql redis minio
(cd backend && php artisan migrate --seed)   # installs the 4 demo users + 10 report types
(cd frontend && npm run dev)                  # http://localhost:5173
```

Then open http://localhost:5173 and follow **DEMO.md**.

## Time spent this session

- 41 minutes wall time (mostly waiting on `pest` runs)
- ~970k tokens
- ~50 files touched
- 4 portals, 13 new pages, 2 new auth modules, 1 new seeder, 1 demo verification script
