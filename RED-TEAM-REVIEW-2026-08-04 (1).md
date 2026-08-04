# RED TEAM REVIEW BOARD
## Civic Intelligence Platform (CIP) v1 — Government Client Demo Readiness Assessment

**Review date:** 2026-08-04
**Scope:** Full-stack correctness, usability, security, operational workflows, demo quality
**Standard:** `docs/17-Pilot-Acceptance-Specification.md` (182 acceptance scenarios), specs 03–16, exit criteria §9.

---

## 1. Executive Summary

CIP v1 is **broadly feature-complete and unusually well-tested** (227 backend test files, portal-level component tests, OpenAPI contract tests). The domain model, 5-portal frontend, workflow engine, routing, moderation, and connector framework all exist and are substantially built out. The architecture is clean and follows its own AGENTS.md layering discipline.

However, **it is NOT demo-safe today.** Two independently-sufficient **Critical blockers** exist that will visibly break or humiliate a government demo, plus a cluster of **High** issues that a sharp client evaluator will probe and find. Crucially, the repo's own docs (`AI_ROUTING_LESSONS.md`) admit the AI pipeline was failing in production as of mid-July and several "fixes" are fragile workarounds, not robust solutions.

The single most alarming finding: **the production frontend is very likely serving a blank page** due to a Vite `base: '/'` vs. sub-directory (`public_html/cip/`) deployment mismatch — the exact failure AGENTS.md explicitly warns about, now present in the live deploy config. No amount of backend correctness matters if the SPA won't boot.

**Bottom line: CONDITIONAL GO slid toward NO-GO until 2 Critical items are fixed and re-verified in the actual pilot environment.** These are small, cheap fixes. The demo should not proceed until they are closed and smoke-tested on the real host.

---

## 2. Demo Readiness Score: **58 / 100**

| Dimension | Score | Notes |
|---|---|---|
| Feature completeness | 78 | Nearly all PAS scenarios have an implementation. |
| Correctness / stability | 40 | Broken SPA deploy path; AI pipeline recently riddled with prod bugs. |
| Security posture | 62 | Good structure (sanctum, rate limiters, policies); a few leaks and gaps. |
| Operational readiness | 48 | cPanel shared-hosting fragility; single-worker queue risk; AI secrets via CI. |
| Demo presentation quality | 45 | Blank-page risk → zero; placeholder legal pages; no favicon risk; "audit" commit. |

---

## 3. Critical Blockers (must fix before demo — will break or humiliate)

### C-1. Production SPA is very likely DOA: `base: '/'` vs. `public_html/cip/` sub-directory
**Severity: Critical · Confidence: High · Impact: The client sees a blank white page.**

- `frontend/vite.config.ts:25` → `base: '/'`.
- Built `dist/index.html` references `src="/assets/index-CUvRTZdp.js"`, `href="/manifest.webmanifest"`, `href="/icons/icon-192.svg"` — **all absolute from web root**.
- But `.github/workflows/deploy-production.yml:85` rsyncs dist into **`public_html/cip/`** *(comment literally: "Frontend dist → public_html/cip/ (not root)")*.
- `deploy/public_html/index.php` header documents dist being extracted at **web-root** (`public_html/assets/`, `public_html/manifest.webmanifest`) — the two deployment artifacts **directly contradict each other.** One of them is wrong against the live server.
- AGENTS.md explicitly warns: *"Relative `./assets` paths make direct refreshes of nested React Router routes render a blank page in production."* The reverse problem applies here — the base path must match where files actually live.

**Consequence:** `https://cip.dgisipl.com/` either (a) 404s every JS/CSS chunk because `/assets/…` resolves to web root instead of `public_html/cip/assets/`, or (b) manifests/SW/icons 404. Either way the PWA won't boot, service worker at `/sw.js` registers the wrong scope, and `manifest.webmanifest` `start_url` (`public/`: `/cip/`, `dist/`: `/citizen`) is inconsistent — **two different manifests are on disk** (`frontend/public/manifest.webmanifest` says `start_url:"/cip/"`, built `frontend/dist/manifest.webmanifest` says `start_url:"/citizen"`). Which one ships is uncontrolled.

**Fix:** Decide the single source of truth. Either (recommend) configure the cPanel subdomain's docroot to `public_html/cip/` and keep `base:'/'`, **or** set `base:'/cip/'` and rebuild. Then align both manifests and SW scope. Verify `curl https://cip.dgisipl.com/assets/…` returns 200 before demo. **~1 hour effort, total demo gate.**

### C-2. Demo-blocking AI auto-route is effectively unreachable (by the team's own admission)
**Severity: Critical · Confidence: High · Impact: The flagship "AI classifies & auto-routes" demo story silently never fires.**

- PAS **AI-001 (P0, Critical)** promises high-confidence auto-routing as the product's centerpiece.
- `docs/AI_ROUTING_LESSONS.md` §3 documents: *"Zero reports auto-routed… every report went to `pending_moderator`."* Threshold lowered 95→90, but §6 then states the `ImageQualityAnalyzer` caps real citizen photos at 70–85%, so **"auto-route is rare in practice. This is by design."** §6 expected-results table shows all sample images land in `pending_moderator`.
- Net effect: the headline feature of "AI auto-classifies and routes" will **not demonstrate** on real images. A government client who submits a genuine pothole photo on the demo floor will watch it go to a human queue — precisely the manual work the product claims to eliminate.
- This is compounded by the threshold + quality-cap being **config-driven but adversarial to each other** (`config/cip.php:24` `auto_route_min=90` vs a quality gate that structurally prevents >90 on real photos).

**Fix:** For demo, treat AI-001 as a scripted path (pre-seed a curated high-quality image that clears 90), **or** make the quality gate less punitive in the 50–80 band per the doc's own "Future option". Decide which story you tell the client, because the honest current behavior is "AI recommends, moderator decides" — and you must not over-promise auto-routing.

---

## 4. High Priority Issues

| # | Issue | Evidence | Impact |
|---|---|---|---|
| H-1 | **AI fraud risk deliberately hidden from moderators**, yet PAS AI-008 (P0) requires "Risk score badge on report" and MOD-007 fraud triage. Recent commits removed the fraud badge from review queue AND the fraud tile from the AI panel — moderators now fly blind on the exact signal the spec calls Critical. | `git show 2e76c759` removed `fraud_score` badge from `ReviewQueuePage.tsx:192`; `4cd9ae56` deleted the fraud tile from `AiAnalysisPanel.tsx` | If hidden because the score was broken (fraud=100 for everything per Lessons §1), the underlying scoring bug may be unresolved and merely masked. Client asking "how do you catch fraud?" has no UI answer. |
| H-2 | **AI pipeline recently had six silent production bugs** bundling fraud=100, duplicate=100, destructively-zeroed confidence (Lessons §1–5). Several fixes are tunings (claim-consistency gates, scoring caps) that were iterated in days — high probability of residual edge-case instability under novel demo inputs. | `AI_ROUTING_LESSONS.md`; commit range `5ea67895`…`0ba33737` | Recommend explicit AI happy-path rehearsal with the exact demo images, and a documented fallback narrative (AI-010/012) since provider outage mid-demo is plausible. |
| H-3 | **`TermsPage` / `PrivacyPage` are explicit placeholders.** Citizen-facing legal pages read *"This page is a placeholder. The full terms of use will be published here."* Government clients specifically scrutinize privacy/terms. | `frontend/src/portals/citizen/pages/TermsPage.tsx:14`, `PrivacyPage.tsx:14` | Embarrassing in a privacy-focused gov demo; PUB-004 privacy story undercut by a placeholder privacy page. |
| H-4 | **Media virus-scan may be running in log-only mode** (PAS §13 limitation #8 admits this). MEDIA-006 (P0) requires actual rejection of infected files. If ClamAV isn't provisioned on the cPanel host, the security claim over-promises. | `docs/17` §13:8 | Verify ClamAV actually runs in the demo env; otherwise pre-emptively scope it. |
| H-5 | **Queue/scheduler single point of failure.** AGENTS.md: report processing requires `queue:work --queue=media,default` AND `schedule:work` running; without them a submitted report **sticks in `submitted` forever and never reaches moderation.** A citizen "submit" that appears to do nothing during the demo is catastrophic. Confirm supervisor config on cPanel keeps both workers alive. | AGENTS.md "Local Development"; Workflow module `Jobs/` | One queued-job stall = the entire J1/J2/J3 journey halts live. |
| H-6 | **Committed env-adjacent files** in git: `frontend/.env.bak`, `frontend/.env.production`, `backend/.env.cpanel`. AGENTS.md says never print/commit env contents. Need to confirm no secrets leaked into the repo history and that `.env.cpanel` merge preserves server secrets. | `git ls-files` shows all three | Rotate any secret that appears in history; scrub `.env.bak`. |
| H-7 | **Phone home / debug logging in non-test code.** Several `console.error/warn/log` in production paths (push subscribe, media upload, export). Low risk individually but should be swept for demo polish. | `client.ts:274,278`; `subscribe.ts:108`; `ExportMenu.tsx:27` | Console noise in a client-facing demo. |
| H-8 | **Unqualified commit `b2c86cf8 "audit"`** sits in recent history with no description. For a gov audit-trail product, sloppy commit hygiene is itself a soft red flag to a technical evaluator reviewing the repo. | `git log` | Cosmetic, but trivially avoidable. |

---

## 5. Medium Priority Issues

| # | Issue | Evidence / Notes |
|---|---|---|
| M-1 | **Auto-route threshold (90) and quality cap are adversarial** — mathematically self-defeating for real photos. Rebalance the 50–80 quality band. | `AI_ROUTING_LESSONS.md` §6 |
| M-2 | **`QwenVLProvider.php:32` `string $apiKey = ''`** default empty credential param. Confirm it's never constructed from a source that can silently default to empty and "work" against a test double in prod. | Provider factory path |
| M-3 | **N+1 risk not provably cleared** — moderation queue/list repositories had **zero `with()` eager-load hits** in my grep; only 21 `paginate()` sites across the whole codebase. A moderation queue with per-row `category`/`media` lazy loads will be p95-slow at demo data volume. MOD-001/OPS-001 dashboards are the highest-traffic screens in a demo. | `git grep 'with(' …Repositories/ → no hits` |
| M-4 | **Duplicate-manifest ambiguity** (see C-1) produces unpredictable PWA install behavior across Android/iOS UAT devices — CIT-020. | two `manifest.webmanifest` files disagree on `start_url`/`scope` |
| M-5 | **6 destructive-flavor migrations** touch reports/AI/integrations with `dropColumn`-family operations. AGENTS.md forbids editing existing migrations; ensure these are all already-applied additive drops with backups, since §9 requires rollback-tested deploy. | `add_ai_label…`, `add_mock_gps_score…`, etc. |
| M-6 | **`scope:"/"` in built manifest vs `start_url:"/citizen"`** lets the SW claim routes it can't serve offline under sub-directory deploy — CIT-016/017 offline demo at risk. | `dist/manifest.webmanifest` |
| M-7 | **OTP limiter and report-submission limiter** are declared (`LIMITER_OTP/CITIZEN`/etc.) but verify each is **registered** in `RouteServiceProvider` with the exact PAS §4.12 rates (OTP 5/h, citizen 20/day, uploads 100 MB/h). | `routes/api.php:70-83`; SEC-004/CIT-023/MEDIA-010 |

---

## 6. Low Priority Issues

| # | Issue |
|---|---|
| L-1 | Portal design-system is duplicated per-portal (`moderator/design/*`, `operations/design/*`) rather than shared — fine for demo, tech-debt later. |
| L-2 | `2FA/TOTP` and real connectors are documented out-of-scope (PAS §13) — do not let a client probe them unknowingly; prep a "roadmap" answer. |
| L-3 | `public/` portal is the thinnest (3 pages) — acceptable per PAS PUB-001…006 but verify stats/heatmap/performance all return real data, not seed zeros. |
| L-4 | `console.info('Service worker registered')` is DEV-gated — confirm `import.meta.env.DEV` false in prod build. |
| L-5 | Several `.test.tsx`/`__tests__` duplicates co-located in `pages/` — harmless. |

---

## 7. Feature Completeness Matrix (vs PAS domains)

| Domain | Scenarios | Implemented | Demo-Safe | Key Gaps |
|---|---|---|---|---|
| AUTH (15) | ~15 | 14 | ⚠️ | Lockout/replay/refresh present; verify limiter registration (M-7) |
| Citizen (24) | ~24 | 22 | ⚠️ | Terms/Privacy placeholders (H-3); offline depends on C-1/M-4 SW |
| AI (16) | ~16 | 15 | ❌ | Auto-route unreachable (C-2); fraud hidden (H-1) |
| Moderator (17) | ~17 | 16 | ⚠️ | Fraud score hidden from UI violates AI-008/MOD-007 |
| Department (16) | ~16 | 15 | ✅ | Accept/start/progress/resolve/close routes + policies present |
| Workflow (13) | ~13 | 13 | ✅ | Transitions + illegal-transition tests exist |
| Routing (6) | ~6 | 6 | ✅ | CRUD + reorder + reassign endpoints present |
| Notifications (8) | ~8 | 8 | ⚠️ | Depends on live push/SMS/email config in pilot env |
| Public (6) | ~6 | 6 | ⚠️ | PII-safe by design; confirm non-zero seeded aggregates (L-3); blank-page C-1 |
| Media (11) | ~11 | 10 | ⚠️ | Virus scan possibly log-only (H-4) |
| Admin (20) | ~20 | 19 | ✅ | Rich admin surface; confirm feature flags actually gate behavior |
| Security (12) | ~12 | 10 | ⚠️ | Rate limits + policies good; env-file hygiene (H-6) |
| Integrations (8) | ~8 | 8 | ✅ | Retry/DLQ/health endpoints registered |
| Operations (10) | ~10 | 9 | ⚠️ | Dashboard + GIS + export; N+1 risk on hot lists (M-3) |

**Legend:** ✅ demo-safe · ⚠️ works but has a caveat · ❌ broken for demo

---

## 8. Workflow Completeness Matrix (Business Journeys J1–J10)

| Journey | Ready | Blocker / note |
|---|---|---|
| J1 Report & Track | ⚠️ | Submit→tracking OK; stuck-in-submitted risk if queue worker down (H-5) |
| J2 AI Triage | ❌ | C-2 auto-route won't fire; H-1 fraud hidden |
| J3 Moderate & Assign | ⚠️ | Approve/reject/reclassify/assign present; fraud signals hidden |
| J4 Resolve | ✅ | Full lifecycle + SLA columns present |
| J5 Configure Platform | ✅ | Admin surface comprehensive |
| J6 Govern & Audit | ✅ | Immutable audit + searchable log endpoints |
| J7 Transparency | ⚠️ | Privacy-safe; verify live data (L-3); SPA boot (C-1) |
| J8 Offline Capture | ⚠️ | SW scope/manifest mismatch (C-1/M-4) jeopardizes demo on airplane-mode test |
| J9 Integrate Externally | ✅ | Mock connectors + DLQ present |
| J10 Secure & Recover | ⚠️ | Rate limits present; ban/appeal + env hygiene (H-6) |

---

## 9. UI/UX Findings

1. **Blank-page risk dominates everything** (C-1) — no UI survives a failed asset load.
2. **Fraud-score UI deliberately stripped** (H-1) creates an explainability hole exactly where PAS wants moderator transparency (MOD-013 AI analysis panel).
3. **Placeholder legal pages** (H-3) visible in citizen portal nav.
4. Recent commit history shows **good UX hygiene work** (label association for inputs `73f4a403`, dialog focus fixes `1837ee18`, jargon→plain-English `8f107afa`, disable-actions-after-close `93590bc2`) — the team *is* polishing; keep going.
5. **Loading/empty/error states**: `PageStates.tsx` + per-portal `EmptyState/ErrorState/Spinner` components exist and are tested (`PageStates.test.tsx`) — satisfies the AGENTS.md triple-state rule in sampled portals.

---

## 10. Security Findings

- **Strong skeleton:** sanctum auth, per-portal RBAC `allow=[...]` arrays, named limiters, Form Requests, module-specific policies, signed media URLs, immutable audit. Genuinely good structure.
- **H-6 env hygiene** — `.env.bak`/`.env.production`/`.env.cpanel` tracked in git is the headline repo-hygiene security finding.
- **H-4 virus scan** may be a security *claim* rather than enforcement.
- **CSP header is absent** from `deploy/public_html/.htaccess` (X-Content-Type, X-Frame, Referrer, Permissions-Policy present; **no `Content-Security-Policy`**, no `Strict-Transport-Security`) — SEC-012 expects both. **Add HSTS + CSP before a security-literate gov reviewer loads DevTools.**
- **No hardcoded application secrets** found in `app/` beyond a benign default-empty constructor param (M-2).
- Geolocation/camera `Permissions-Policy` is correctly scoped `=(self)` — good for the PWA's `getUserMedia`/GPS.

---

## 11. AI Findings

- The AI pipeline is **real and multi-provider** (OpenAI-compatible base, Qwen-VL, Vertex/Gemini via env + service-account provisioning in CI), with failover service, confidence aggregation, duplicate detection (perceptual-hash + time-boost), fraud scoring, image-quality analysis, and PII masking. Architecturally solid.
- **Operationally, it is the least-stable subsystem.** A dedicated lessons-learned doc catalogs six recent production bugs, several of which produced **wrong-by-100** scores or **zero confidence** on valid images. The mitigation pattern (lower thresholds, gate behind secondary signals, cap scores) is reactive tuning.
- **C-2:** auto-route is unreachable on real photos by design.
- **H-1:** fraud score now hidden from moderators, contradicting AI-008/MOD-007.
- **Recommendation:** Rehearse the AI path with the exact demo images; capture a known-good AI analysis panel screenshot as a backup; script the "provider down → moderator queue" fallback as a *resilience feature* to demo (it converts a weakness into a selling point per AI-010/012).

---

## 12. Performance Findings

- **M-3 N+1 on hot lists is the largest risk.** Moderation queue, department inbox, and ops dashboards are the exact screens a client will hammer; zero eager-loading evidence in repositories + only 21 pagination sites is a red flag for p95 at any real seed volume. Run a query-count check (e.g. Laravel Debugbar / `DB::listen`) on `/moderator/queue` with ~200 reports before demo.
- **Media signed URLs + hash pipeline** are designed correctly (MEDIA-001/007); video processing is on the `media` queue (H-5 dependency).
- **Public stats should be cached 5 min** (PUB-006) — verify the cache actually warms so the public portal loads in <2s.
- Pilot perf thresholds (§9.8: submit <10s, dashboard <2s, API p95 <500ms, AI <30s) are **not measured anywhere in evidence I found** — measure the three hot endpoints now.

---

## 13. Public Portal Review

- **Privacy posture (PUB-004, pilot-critical) is sound by construction:** separate `Public` module, throttled, no auth, grid-bucketed heatmap, no PII joins.
- **Three pages only** (Overview/Heatmap/DepartmentPerformance) — matches PAS scope (aggregates only, no per-report lookup, per §13:10).
- **Risks:** (a) C-1 blank-page makes the public portal — the most client-visible artifact — most fragile; (b) verify aggregates are **non-zero and seeded** for the pilot ward (BBMP 112 / BTP), or the transparency dashboard demos as an empty dashboard; (c) confirm the `30 req/min` limiter and 5-min cache are live.

---

## 14. Missing Demo Features (highest embarrassment-per-effort ratio)

1. Working, auto-routing AI demo story (C-2).
2. Fraud-risk signal somewhere moderator-visible, or a scripted explanation (H-1).
3. Real Terms/Privacy content (H-3).
4. Non-empty, realistic public-portal aggregates for the pilot geography (L-3).
5. HSTS + CSP headers (Security finding) — trivial to add, frequently checked.
6. A verified offline/airplane-mode citizen capture demo (depends on C-1/M-4 SW fix).
7. A rehearsed "queue worker is healthy" check so J1 completes live (H-5).
8. A backup AI-result screenshot in case the live provider wobbles (H-2).

---

## 15. Recommended Final Polish Sprint (exactly 20 tasks, ordered by ROI)

1. **[C-1]** Resolve deploy path: set cPanel subdomain docroot to `public_html/cip/` (keep `base:'/'`) **or** switch `base:'/cip/'` + rebuild; reconcile the two manifests to one `start_url`/`scope`.
2. **[C-1]** `curl` the 5 hard asset URLs on prod to confirm 200s; hard-refresh `/citizen/reports/123` directly to confirm no blank page.
3. **[C-2]** Decide & rehearse the AI auto-route demo path (curated ≥90 image or relaxed 50–80 quality band); script the exact utterance.
4. **[C-2]** Pre-seed one known-good high-confidence report so J2 can be shown end-to-end.
5. **[H-1]** Restore a non-scary fraud indicator (or document why hidden + the verbal fraud-triage answer for MOD-007).
6. **[H-5]** Add supervisor/systemd persistence for `queue:work --queue=media,default` + `schedule:work` on cPanel; add a boot-time health check.
7. **[H-5]** Dry-run: submit a report in the **pilot** env and watch it reach moderation unaided.
8. **[M-3]** Query-count audit + eager-load the moderation queue, dept inbox, ops dashboard; confirm p95 <500ms at ~200 seed reports.
9. **[Sec]** Add `Strict-Transport-Security` + `Content-Security-Policy` to `.htaccess`.
10. **[H-6]** Scrub `frontend/.env.bak`; confirm no secrets in git history; rotate any that exist.
11. **[H-3]** Replace Terms/Privacy placeholders with final copy (even concise real text beats a placeholder).
12. **[H-4]** Confirm ClamAV runs in pilot env, or scope the virus-scan claim in your narrator script.
13. **[L-3]** Seed realistic, non-zero public aggregates + heatmap for BBMP ward 112 / BTP.
14. **[H-2]** Run the full AI suite **on the real provider** with the 6 real fixture images from `AI_ROUTING_LESSONS.md`; confirm fraud≈20, duplicate≈0, sane confidence.
15. **[H-2]** Prepare the "AI provider outage → automatic moderator queue" live fallback demo.
16. **[M-7]** Verify every named limiter is registered with PAS §4.12 rates (OTP 5/h, citizen 20/day, upload 100 MB/h, public 30/min).
17. **[H-7]** Sweep non-test `console.*` from production paths.
18. **[M-6]** Confirm SW scope can't claim un-servable routes offline; airplane-mode test on a real Android + iOS device.
19. **[M-5]** Confirm the 6 drop-family migrations already applied + a fresh timestamped DB backup exists and restores.
20. **[Cosmetic]** Rebase/squash the naked `audit` commit + tidy recent AI-tuning commits into coherent messages for any repo review.

---

## 16. Recommendation

## **NO-GO today → reachable CONDITIONAL GO within this sprint**

**Verdict: NO-GO in current state.**

**Why:** Two independent Critical defects (C-1 blank-page deploy path, C-2 unreachable flagship auto-routing) each alone justify blocking a government demo. C-1 in particular is disqualifying — if the SPA serves a blank page, nothing else matters.

**However** — this is a **high-confidence, low-effort recovery.** Neither Critical requires redesign or new features; both are configuration/verification work. The sprint above (Tasks 1–7 are the gate) is **~1–2 engineering days.**

**Convertible to CONDITIONAL GO when:**
1. C-1 fixed **and verified live on the pilot host** (asset 200s + direct nested-route refresh renders). — *This is absolute.*
2. C-2 AI demo path scripted & rehearsed end-to-end in the pilot env (auto-route fires, or the moderator-decides story is explicitly the pitch).
3. H-5 queue/scheduler persistence proven in pilot.
4. Tasks 8–13 complete.

**Confidence:** High on the blocker identification (file:line evidence throughout); Medium on absolute deploy behavior (review based on config, not the live server — the exact failure mode depends on the actual cPanel docroot, which was not readable; but the config-internal contradiction is unambiguous and **must** be resolved before demo regardless).

**Recommendation to the board:** Do not schedule the client demo until Tasks 1–7 are closed and re-run against `cip.dgisipl.com`. The team's recent velocity on exactly these polish items suggests they can get there fast — but "feature complete" is not "demo safe," and today it is not demo safe.

---

*End of Red Team Review — Civic Intelligence Platform v1.*
