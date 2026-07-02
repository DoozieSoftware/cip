# CIP Alignment Plan — Phase 1 of Post-Audit Remediation

## Context

The red-team documentation-vs-implementation audit (see prior conversation) found that the AI pipeline cannot process a single real report today (no provider is ever bound into the app container), staff have no way to log in outside test harnesses, a whole product surface (Public Portal) was silently dropped from Vision/PRD, and several stakeholder-facing claims (DEMO.md, landing page metrics, `.codex` completion %) are fabricated or stale. The user reviewed the 8 open consensus questions and confirmed:

1. AI providers should be real and configurable — specifically custom OpenAI-compatible endpoints on **Modal.com** and **OpenRouter**.
2. Staff password auth should be built, then docs corrected to match.
3. The Public Portal was "lost track of," not intentionally cut — it's needed.
4. Citizen offline-queue wiring is secondary but required.
5/6. DEMO.md and the landing page need to be made accurate (real data, no dead demo steps).
7. `.codex` tracking is trusted through M10; M11 onward needs to be rebuilt to match reality.
8. Mock-GPS→moderator wiring is needed in v1.

This plan sequences all 8 into one priority-ordered build, executed phase-by-phase with a check-in after each phase.

## Phase 1 — AI: real, configurable providers (Modal.com / OpenRouter) + fix the container-binding gap

**Root cause (confirmed by exploration):** `ProviderFailoverService` (`backend/app/Modules/AI/Services/ProviderFailoverService.php:40-47`) takes a `$bindings` array that nothing ever populates — no `Modules/AI` service provider exists in `backend/bootstrap/providers.php`, and `AppServiceProvider::register()` is empty. `ai_provider_configs` rows are read for metadata only; the actual PHP provider instance is never constructed from them. `OpenAICompatibleProvider` is otherwise generic enough (base_url/model/key are constructor params, not hardcoded) to talk to any OpenAI-chat-completions-shaped endpoint — which covers OpenRouter directly and Modal.com if the deployed Modal endpoint speaks that shape.

**Backend changes:**
- New migration on `ai_provider_configs`: add `driver` (string, e.g. `openai_compatible`/`qwen_vl`/`mock` — the type discriminator that's currently missing), `extra_headers` (json, nullable — for OpenRouter's `HTTP-Referer`/`X-Title` or Modal-specific headers), and `credentials` (encrypted json, replacing the unused `api_key_secret_id` — mirror the encrypted-credentials-masked-as-`********` pattern already used by `Integration`/`NotificationChannelConfig` models rather than building a new secrets store).
- New `backend/app/Modules/AI/Support/AiProviderFactory.php`: maps `driver` → provider instance, reading `base_url`, `model`, `credentials['api_key']`, `extra_headers`, `timeout_ms`, `temperature` off the config row.
- Update `OpenAICompatibleProvider` (`backend/app/Modules/AI/Providers/OpenAICompatibleProvider.php`): accept `array $extraHeaders = []` in the constructor and merge into the outbound request; make the health-check path tolerant of a 404 on `/v1/models` (Modal-deployed endpoints often don't expose it) by falling back to a lightweight `HEAD`/root-path check instead of hard-failing.
- New `backend/app/Modules/AI/Providers/AiServiceProvider.php`, registered in `bootstrap/providers.php`: on `boot()`, query active `AiProviderConfig` rows, build each via `AiProviderFactory`, and bind the resulting array into a singleton `ProviderFailoverService`. **This is the fix for the Critical finding** — real classification becomes possible for the first time.
- Wire the two already-built-but-orphaned safety pieces into the live pipeline, since they live in the exact files this phase touches:
  - `ConfidenceAggregator` into `AiCompletedListener::handle()` — only auto-assign (`ai_auto_assign` transition) above the documented confidence threshold; below it, transition to `pending_moderator` instead, restoring the "moderator always overrides AI" guarantee.
  - `PiiMaskingService` into `AiPipelineOrchestrator::handle()` for the structured-field masking it already implements (mobile/email/address). Real face-blurring is a separate, much larger feature (no image-processing capability exists anywhere in the repo) — out of scope here; DEMO.md's face-stripping claim will be corrected to describe what's actually true (Phase 3).
  - Wire `app_configs.ai.vision.enabled` into the service provider/orchestrator so the feature-flag flip DEMO.md already scripts actually does something (falls back to `pending_moderator` with no AI step when off).
- Update `StoreAiProviderRequest`/`UpdateAiProviderRequest` to validate `driver` (enum) and `extra_headers` (array); update `AiProviderConfigResource` to expose `driver`/masked `credentials`/`extra_headers`.

**Frontend changes:**
- `frontend/src/portals/admin/pages/AdminAi.tsx` Providers tab currently has no create/edit form at all (`useCreateAiProvider`/`useUpdateAiProvider` exist in `client.ts:486-501` but are dead code). Build the form: driver dropdown, base_url, model, key/value editor for `extra_headers`, credential field (write-only), temperature/timeout/retry/priority/fallback/active.
- Fix the `AiProvider` TS interface drift in `client.ts` (`driver`, `cost_per_1k_in/out`, `last_health_status` referenced but don't exist backend-side; replace with the real field set).

**Tests:** feature test for `AiServiceProvider` binding a real request end-to-end against a faked HTTP response for an `openai_compatible` driver config; unit test for `extra_headers` merge; admin CRUD validation tests for `driver`; confidence-gate test (low-confidence report lands in `pending_moderator`, not auto-assigned); frontend vitest for the new form.

**Docs:** `docs/ai.md` — fix the pipeline diagram to match reality, remove the fabricated `registerAiProviders()` example, correct "Qwen-VL default" (mock is default), add a "configuring a custom OpenAI-compatible provider (OpenRouter, Modal.com)" section.

## Phase 2 — Staff password authentication

**Backend:**
- Add `LIMITER_LOGIN` to `RouteServiceProvider` (stricter than OTP's 5/hr — e.g. 10/hr per IP+identifier) and a new `POST /api/v1/auth/login` route in `backend/routes/api.php` alongside the existing `send-otp`/`verify-otp` group.
- `AuthenticationService::loginWithPassword()` mirrors `verifyOtp()` exactly (`backend/app/Modules/Authentication/Services/AuthenticationService.php:44-99`): `Hash::check($password, $user->password)` (the `password` column already exists, already has the `hashed` cast — `User.php:108` — so this is a drop-in), `recordLogin`, `createToken(name: 'password-login')`, `refreshTokens->issue(...)`, `recordLoginHistory`, `UserAuthenticated::dispatch($user, 'password', ...)`. Return the same array shape so `AuthController` can reuse the existing response-building code.
- Failed-attempt lockout mirrors `OtpService`'s attempt-counter pattern (`OtpService.php:131-166`) — new counter (on `User` or a dedicated table), lock out after N failures in a window, emit the now-wired `LOGIN_FAILURE`/`LOGIN_SUCCESS` security events (this directly fixes the "5 of 6 security events never fire" Critical finding, since login is the code path being rewritten).
- Wire password policy for real: fix `SecurityPoliciesSeeder`'s `password.min_length` default (currently 8, spec says 12) and add the missing complexity flags; build `SecurityPolicyService::passwordRule(): Password` that reads the `SecurityPolicy` row and returns Laravel's `Illuminate\Validation\Rules\Password` configured accordingly; call it from `StoreUserRequest`/`UpdateUserRequest`/the new login-password-set flow. This makes the Security Policies admin screen have a real runtime effect for password rules (the other Critical finding — full OTP-expiry/rate-limit wiring is a related but separate fast-follow, out of scope here).
- Password history/expiry (docs/11 §8) has zero backing storage today (no table exists) — scoping this phase to complexity + login only; flag history/expiry as an explicit fast-follow rather than silently dropping it.

**Frontend:** add a password field + mode toggle to the staff sign-in path in `LoginPage.tsx`, call the new endpoint.

**Docs:** rewrite `docs/auth.md` and README's Authentication section to describe OTP (citizens) + password (staff) as final; fix the `BasePolicy` path citation while touching this doc; correct docs/11 §8 to match the shipped policy scope (complexity now, history/expiry noted as follow-up).

**Tests:** login success/failure/lockout, policy-enforcement (reject weak password), security-event emission, frontend form test.

## Phase 3 — DEMO.md + landing page accuracy

- New lightweight, unauthenticated, cached (~5 min), rate-limited `GET /api/v1/public/stats` endpoint (total reports, % AI-classified, median submit→assign time from `report_status_history`) — built once here, reused by Phase 5's Public Portal.
- `LandingPage.tsx`: replace the hardcoded metrics array (`146-158`) with a `useQuery` against `/public/stats`, with a loading/fallback state.
- `DEMO.md`: the Security Policies step becomes true after Phase 2 (real password-policy edit) — reword it accordingly. The Feature Flags step becomes true after Phase 1's `ai.vision.enabled` wiring — reword to describe the actual fallback behavior.

**Tests:** endpoint test for `/public/stats` correctness and privacy (no PII), frontend test for the landing page data fetch.

## Phase 4 — Citizen offline queue + mock-GPS wiring (secondary priority, bundled — same touch-point)

- `SubmitPage.tsx`: on submit network failure (not validation failure), call the existing `getQueue().enqueue(...)` (`offline/queue.ts`) instead of just showing "Submit failed"; show a "saved offline" toast.
- Register `swBridge.ts`'s `onQueueDrain`/`onPushReceived`/`onPushNavigate` listeners at the `CitizenApp.tsx` level (currently built, never called) — drain success invalidates the dashboard/my-reports query cache; push messages feed the notifications inbox.
- Replace `SubmitPage.tsx`'s ad hoc `detectLocation()` with `GpsCapture.tsx` (already built, currently unused) so the mock-GPS score is actually computed; attach the score to the submit payload; add a `mock_gps_score` column to `reports` (or a submit-time `security_events` row); surface it read-only in the moderator `ReportDetailPage` fraud panel (fixes the "score is stored... moderator portal uses it to triage" claim).
- Fix `citizen-offline-submit.spec.ts` to exercise the real `getQueue()` singleton and real listener wiring instead of the hand-rolled stand-in it currently uses.

**Tests:** vitest for the offline fallback path, corrected Playwright offline-submit spec, backend test for `mock_gps_score` storage + moderator read.

## Phase 5 — Public Transparency Portal

Scope per Vision §7 / PRD M7: public statistics, area-level heat maps, resolution dashboards, department performance. No PII, no exact coordinates, no evidence access — consistent with the Vision's Privacy-By-Design principle.

- New thin `backend/app/Modules/Public/` module (read-only aggregation services reusing existing Report/Department repositories, per the modular-architecture rule in AGENTS.md): `PublicStatsController` (extends Phase 3's endpoint), `PublicHeatmapController` (ward/grid-bucketed counts, never exact lat/lng), `PublicDepartmentPerformanceController` (resolution rate / median SLA per department, no internal notes or officer names).
- New frontend portal `frontend/src/portals/public/PublicApp.tsx`, mounted at `/public` in `App.tsx`: Overview, Heatmap (Leaflet, same pattern as `GisMapPage.tsx`), Department Performance (ECharts). Reuses the moderator `design/` component set the way Admin already does.
- Add a "Public stats" link from the Landing page.
- New `docs/public.md` (matching the `docs/admin.md` pattern) + README "Public Portal" section.

**Tests:** backend aggregation-correctness + privacy-leak tests (assert no PII/exact-location in any public response), frontend vitest + Playwright a11y for the new portal.

## Phase 6 — `.codex` tracking rebuild (M11 onward)

Done last so it reflects final state.

- Regenerate `.codex/completed_tasks.md` entries for M11/M12/M13 from git history + on-disk evidence (already spot-verified as real code in the audit) in the same format as the trusted M1-M10 entries.
- Reconcile `.codex/task_queue.md` status markers for M11-M13 (currently "Not Started," contradicting reality) and fix the stale `frontend/apps/citizen/` path reference for T-M13-001.
- Recompute one consistent completion percentage across `current_milestone.md`/`task_queue.md`/`completed_tasks.md`, and log this plan's new work (Phases 1-5, plus Public Portal as a new milestone) as new tracked tasks.

## Verification (end of each phase)

- Backend: `cd backend && vendor/bin/pest --parallel` + `vendor/bin/phpstan analyse` + `vendor/bin/pint --test`.
- Frontend: `cd frontend && npm test -- --run` + `npm run build` + `npm run lint`.
- Manual smoke per phase: Phase 1 — trigger a report submit against a sandboxed OpenRouter/Modal test key and confirm `ai_jobs.status = completed`; Phase 2 — log in as a seeded staff user with a password; Phase 3 — load the landing page and confirm the numbers change when a report is added; Phase 4 — submit while offline (devtools network throttle) and confirm the report appears after reconnecting; Phase 5 — load `/public` unauthenticated and confirm no PII/exact coordinates appear in the network tab.

I will implement one phase at a time and check in with you before moving to the next.
