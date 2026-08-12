# 17 - Bengaluru Public Platform Product, UX, and Production Readiness Assessment

**Project:** Civic Intelligence Platform  
**Assessment date:** 2026-08-06  
**Status:** Proposed implementation roadmap  
**Scope:** Citizen, public, moderator, department, super-admin, backend, deployment, security, data, and maintainability

---

## 1. Purpose

This document consolidates:

- Bengaluru civic-grievance research.
- A read-only audit of the current citizen and public journeys.
- A read-only audit of moderator, department, and administration workflows.
- A read-only backend, security, deployment, and scalability audit.
- A maintainability and industry-standards assessment.
- A target business flow and prioritized implementation roadmap.

It is intended to be the source document for deciding what to build next. It is not approval to deploy, migrate production data, or change production configuration.

---

## 2. Executive Verdict

The platform has a credible modular foundation, broad portal coverage, substantial automated tests, strict PHP typing, signed evidence concepts, workflow services, and a coherent visual direction.

It is **not ready for a Bengaluru public launch**.

The principal blockers are not visual polish. They are:

1. Production OTP delivery and production OTP exposure.
2. Reports becoming official before evidence uploads are complete.
3. Evidence and AI processing racing each other.
4. Offline reports crossing user accounts on shared devices.
5. Broken lifecycle notifications and disconnected Web Push.
6. Missing citizen verification, dispute, reopening, and trustworthy closure proof.
7. Queue, scheduler, cache, malware-scanning, backup, and deployment defects.
8. Authorization bypasses in internal AI and AI prompt administration.
9. Missing Bengaluru jurisdiction resolution and incomplete multi-agency execution.
10. Large, coupled files and duplicated frontend infrastructure that make safe change increasingly expensive.

The recommended approach is **not a rewrite**. Keep Laravel, React, MySQL, Redis, and the existing module boundaries. First repair security and transactional correctness, then make closure trustworthy, then expand channels and intelligence, while incrementally extracting shared infrastructure and reducing file-level complexity.

---

## 3. Severity And Delivery Definitions

| Level | Meaning | Release treatment |
|---|---|---|
| P0 | Security, data-integrity, authentication, deployment, or core-flow failure | Must be fixed before public traffic |
| P1 | High-value trust, workflow, reliability, or operational issue | Must be fixed before a multi-ward pilot |
| P2 | Material usability, inclusion, transparency, or maintainability issue | Deliver during pilot hardening |
| P3 | Optimization or advanced intelligence | Deliver only after reliable baseline metrics exist |

---

## 4. Bengaluru Research Summary

### 4.1 Current Civic Context

Research into BBMP Sahaaya 2.0/Namma Bengaluru and Bengaluru grievance reporting indicates:

- OpenCity reported **126,974 grievances across 198 wards** between January and June 19, 2025, averaging approximately 638 complaints per ward.
- Electrical/streetlight and solid-waste issues dominate complaint volume. Road maintenance has materially weaker reported resolution performance.
- Bengaluru residents must navigate BBMP, BWSSB, BESCOM, BTP, BMTC, BMRCL, BDA, BMRDA, and other bodies. Existing integration is incomplete, and agency ownership is often unclear to a citizen.
- Peripheral growth wards, including Horamavu, Jnanabharathi, and Thanisandra, show high complaint volume and infrastructure pressure.
- Existing channels include apps, phone, WhatsApp, email, ward offices, and social media. Fragmentation creates uncertainty about which channel is authoritative.
- Bengaluru has announced efforts to consolidate multiple civic applications into a common platform. A new platform should therefore prioritize interoperability and channel unification rather than become another isolated complaint application.

### 4.2 The Core Trust Problem Is False Closure

Credible Bengaluru reporting repeatedly describes:

- Complaints closed without field work.
- Blank, blurry, irrelevant, or citizen-submitted images reused as closure proof.
- Tickets closed faster than plausible physical resolution.
- Officials unaware of assignments attributed to them.
- Stale or transferred officer contact details.
- Responsibility disputes between wards, departments, and agencies.
- Citizens lacking a clear in-product reopening or dispute mechanism.

This means the primary product promise cannot be "easy reporting." It must be:

> A report cannot disappear, transfer without trace, or close without verifiable evidence and a citizen-visible accountability path.

### 4.3 Lessons From Proven Civic Platforms

**FixMyStreet** demonstrates:

- Location-first reporting.
- Nearby-report discovery before creating a duplicate.
- Public visibility of reports and updates.
- Responsible-authority routing from geography.
- Area subscriptions and multilingual deployment.

**NYC 311** demonstrates:

- Multi-channel service: phone, web, mobile, SMS, and notifications.
- A stable case number used consistently across channels.
- Published service commitments and open data.
- Independent analytics based on public service-request data.

**Boston 311/Open311** demonstrates:

- Open data with data dictionaries.
- Stable APIs that support a civic technology ecosystem.
- Longitudinal public accountability.

**SeeClickFix** demonstrates:

- Immediate jurisdiction feedback.
- Integration with work-order systems rather than double entry.
- Public status updates generated from operational work.
- Community support/upvotes instead of duplicate tickets.

### 4.4 Product Implications For Bengaluru

The platform should optimize for:

1. Trustworthy closure and easy dispute.
2. Agency and jurisdiction resolution invisible to the citizen.
3. Low-friction reporting on low-end devices and unreliable networks.
4. Kannada and assisted access.
5. One stable tracking identity across every channel.
6. Public transparency without exposing precise sensitive locations or personal data.
7. Field-officer efficiency, not only citizen convenience.
8. Explicit SLA ownership and escalation.

---

## 5. Product Principles

1. **Citizens report a problem, not a department.** The platform owns routing.
2. **No official submission before evidence is durable.** Draft, upload, validate, then finalize.
3. **No invisible handoff.** Every transfer has sender, receiver, timestamp, acknowledgement, reason, and deadline.
4. **No unverifiable closure.** Resolution requires proof, notes, responsible assignment, and a dispute window.
5. **No dead-end status.** Every non-terminal state has an owner, next action, and escalation path.
6. **No color-only meaning.** Status always combines label, icon, text, and accessible contrast.
7. **No public exact-location leakage.** Public views aggregate or suppress sparse data.
8. **AI recommends; accountable staff decide.** AI must not silently reject or close reports.
9. **Configuration must control runtime behavior.** An admin setting that runtime code ignores is worse than no setting.
10. **Operational simplicity before feature breadth.** Reliable OTP, queues, evidence, notifications, backups, and audit come before advanced AI.

---

## 6. Target End-To-End Business Flow

### 6.1 Discover And Access

1. Citizen opens the public web app, WhatsApp flow, assisted-service channel, or phone-supported workflow.
2. Platform displays service area, supported issue types, language, privacy summary, and emergency guidance.
3. Citizen signs in using a real OTP or begins an explicitly supported anonymous/assisted flow.
4. Session and queued drafts are scoped to the authenticated account.

### 6.2 Create A Draft

1. Citizen captures or selects issue location.
2. Platform resolves ward, corporation, service zone, and candidate agency from authoritative GIS boundaries.
3. Nearby open reports are shown before a new report is created.
4. Citizen can support an existing report or continue with a distinct issue.
5. Draft is saved locally and server-side with one durable client-generated idempotency key.

### 6.3 Capture Evidence

1. Evidence requirements come from the selected report type.
2. Photos/video upload resumably to object storage.
3. Client and server validate count, type, size, duration, hashes, metadata, and malware scan.
4. Citizen sees each asset as pending, uploading, uploaded, or failed.
5. The platform does not finalize while required evidence is incomplete.

### 6.4 Finalize Submission

1. Backend locks the draft and validates ownership, evidence, location, report type, and idempotency.
2. Backend creates the official `CIV-*` tracking number once.
3. Location, report, media references, workflow transition, audit entries, and outbox events commit atomically.
4. Citizen receives the same tracking number in app, SMS, email, WhatsApp, and assisted receipts.

### 6.5 Classify And Route

1. Hash-ready evidence triggers one unique AI job per report version.
2. AI stores category suggestion, labels, quality, fraud, duplicate candidates, and explanation.
3. GIS and routing rules identify the responsible primary agency and any secondary tasks.
4. Low-confidence, fraud, duplicate, unresolved-jurisdiction, or cross-agency reports enter explicit human queues.
5. Every assignment requires acknowledgement.

### 6.6 Resolve

1. Primary officer accepts the assignment and sees SLA, route, evidence, dependencies, and contact-safe citizen context.
2. Secondary agencies receive task-specific actions, not primary lifecycle authority.
3. Officer records progress and resource blockers.
4. Resolution requires notes and after-evidence tied to the assignment and officer.
5. Server validates proximity, chronology, evidence quality, and open dependencies.

### 6.7 Verify Or Dispute

1. Report enters `resolved_pending_verification` rather than immediately closing.
2. Citizen sees before/after evidence, public resolution notes, responsible agency, and resolution timestamp.
3. Citizen can confirm, dispute, or allow a clearly communicated timeout.
4. Dispute reopens into a supervisor queue and cannot return only to the same closing officer.
5. Closure records satisfaction and whether the SLA was met.

### 6.8 Publish And Learn

1. Public dashboards publish aggregated, privacy-safe status and SLA metrics.
2. Duplicate supporters receive canonical-report updates.
3. Reopen rate, evidence rejection, handoff delay, and satisfaction are used to improve policy.
4. Operational analytics distinguish reported closure from citizen-confirmed resolution.

---

## 7. P0 Findings: Must Fix Before Public Traffic

### P0-01: Production OTP Is Not A Real Delivery Flow

**Current issue**

- `backend/app/Modules/Authentication/Services/OtpService.php` logs OTPs instead of sending through a real provider.
- The production template/deployment enables debug OTP behavior, allowing the plaintext code to be returned outside local development.
- The configured OTP rate limit is materially above the security specification.
- The login page still describes demo behavior.

**Impact**

- Real citizens may not receive a code.
- Debug behavior creates an account-takeover path.
- OTP values and mobile numbers can enter retained logs.

**Required solution**

1. Integrate a production Indian transactional SMS provider with DLT-approved templates.
2. Remove debug OTP from production config and deployment.
3. Redact OTP and mobile data from logs.
4. Restore strict send/verify/resend limits and progressive backoff.
5. Add delivery receipts, provider health checks, and provider failover.
6. Add Kannada and English OTP templates.
7. Block deployment when production debug OTP is enabled.

### P0-02: Internal AI Authorization Bypass

**Current issue**

- `/internal/ai` routes use authentication but do not enforce the required `system` role.
- `InternalAiController` does not perform policy or role authorization.
- AI prompt approve/rollback actions do not consistently apply the same admin authorization as other prompt actions.

**Impact**

- Any authenticated user may dispatch expensive AI processing or inspect internal AI results.
- A non-admin may alter globally approved prompts.

**Required solution**

1. Add system-only route middleware and narrow token abilities.
2. Add policy checks in controllers as defense in depth.
3. Restrict internal endpoints to private network or mTLS where possible.
4. Add citizen, officer, moderator, auditor, and non-admin denial tests.

### P0-03: Reports Finalize Before Evidence Upload Completes

**Current issue**

- `frontend/src/portals/citizen/api/client.ts` creates the report, starts uploads without awaiting durable completion, suppresses upload errors, and returns success.
- `ReportService::submit()` transitions the report without enforcing report-type evidence requirements.

**Impact**

- Official reports can have missing evidence.
- The UI can display success when evidence failed.
- AI and moderation may act on incomplete data.

**Required solution**

1. Introduce server-side draft creation.
2. Upload all required media resumably.
3. Validate evidence server-side from report-type configuration.
4. Finalize through one idempotent endpoint only after evidence is ready.
5. Return a field-level upload manifest and keep failed assets actionable.

### P0-04: AI Can Run Before Evidence And Hashes Are Ready

**Current issue**

- Multiple listeners can dispatch AI for one report.
- AI inspects one selected media item rather than a defined evidence set.
- Duplicate detection may execute before hashes exist and return zero risk.
- The orchestrator lacks a report-scoped unique job or distributed lock.

**Impact**

- Duplicate AI rows and lifecycle events.
- Classification based on partial evidence.
- False-negative duplicate checks.
- Excess provider cost during retries/outages.

**Required solution**

1. Emit a single `ReportEvidenceReady` event.
2. Use a unique job keyed by report and evidence revision.
3. Add a Redis lock and idempotent result writer.
4. Define evidence-selection policy across all assets.
5. Persist result, labels, report scores, and outbox event in one transaction.
6. Add circuit breakers and bounded provider retry budgets.

### P0-05: Offline Queue Is Not Account-Scoped

**Current issue**

- IndexedDB queue entries do not store the owning user.
- Logout does not clear or partition drafts/evidence.
- The next user on the device can drain the previous user's queued report using the new token.

**Impact**

- Reports can be submitted under the wrong citizen.
- Evidence can leak on shared devices.

**Required solution**

1. Scope every draft and queue item to a stable account identifier.
2. Encrypt sensitive local drafts where practical.
3. On logout, stop queue processing and offer clear/delete/preserve choices.
4. Never drain an item when its owner differs from the active session.
5. Add shared-device regression tests.

### P0-06: Notification Templates Fail With Production Data

**Current issue**

- Seeded templates require variables such as `name` and `city`.
- lifecycle listeners do not provide those variables.
- listeners swallow template exceptions.
- status listeners can pass UUIDs rather than readable names.
- tests use simplified templates and mask the production failure.

**Impact**

- Notification rows are never created for key lifecycle events.
- Citizens receive no assignment or status updates.

**Required solution**

1. Define typed template contracts per event.
2. Validate templates at save/publish time.
3. Build payloads from readable domain values.
4. Test against production seed templates.
5. Record rendering failures in an operational queue instead of swallowing them.

### P0-07: Web Push Is Disconnected

**Current issue**

- Browser Web Push subscriptions store endpoint and encryption keys.
- `PushChannel` expects an FCM device token.
- lifecycle listeners often force email even when OTP-only citizens have no email.

**Impact**

- Push subscription appears successful but cannot deliver lifecycle updates.

**Required solution**

1. Implement a real Web Push channel using the stored subscription format.
2. Keep FCM and Web Push as separate channel implementations.
3. Select channels from verified contact methods and citizen preferences.
4. Add delivery attempts, receipts, retry policy, and dead-letter handling.

### P0-08: Queue And Scheduler Production Topology Is Broken

**Current issue**

- Media jobs target the `media` queue, while production workers consume only the default queue.
- workers can overlap because a new stop-when-empty worker is started repeatedly.
- queue `retry_after` is shorter than possible worker execution time.
- deployment does not install the Laravel scheduler.

**Impact**

- Hash, thumbnail, video metadata, SLA, and retention jobs can stall.
- long jobs can execute twice.

**Required solution**

1. Run supervised, bounded workers for `media`, `ai`, `notifications`, and `default`.
2. Set `retry_after` above maximum worker timeout.
3. Install `schedule:run` each minute or a supervised scheduler.
4. Add queue-age, failed-job, worker-heartbeat, and scheduler-heartbeat alerts.

### P0-09: Production Cache Is Incompatible With Routing

**Current issue**

- Production is configured with file cache.
- routing repositories call tagged cache APIs unsupported by the file store.

**Impact**

- automated routing can fail and leave reports stuck in AI processing.

**Required solution**

1. Use Redis for cache, locks, and rate limiting in production.
2. Add a production-configuration smoke test that evaluates one routing rule.
3. Fail readiness when required Redis capabilities are unavailable.

### P0-10: Malware Scanner Is Not Provisioned Or Verified

**Current issue**

- Production selects ClamAV.
- deployment does not provision or verify `clamscan`/`clamd` and signatures.

**Impact**

- Public uploads may all fail or run without the expected control.

**Required solution**

1. Use a managed or containerized `clamd` service.
2. Add deploy-time and runtime health checks.
3. Quarantine failed/unknown scans rather than losing uploads silently.

### P0-11: No Executable Backup, Restore, Or Rollback

**Current issue**

- Deployment rsyncs and migrates in place.
- no pre-deploy integrity-checked database backup exists.
- evidence storage, configuration, and `APP_KEY` are not covered by one tested process.
- no immutable release directory or atomic rollback exists.

**Impact**

- deployment or storage failure can create permanent data loss.

**Required solution**

1. Back up MySQL, evidence storage, and configuration as separate domains.
2. Integrity-check every backup and preserve `APP_KEY`.
3. Deploy immutable releases and switch an atomic symlink.
4. Define and rehearse rollback and restore runbooks.
5. Track RPO/RTO and run recurring restore drills.

### P0-12: Production Deploys Without A CI Gate

**Current issue**

- a push to `main` can trigger deployment independently of CI success.
- no protected production approval environment is enforced.
- dependency audits are non-blocking.

**Impact**

- failing or vulnerable code can deploy automatically.

**Required solution**

1. Trigger deployment only from a successful CI workflow or signed release.
2. Require a protected production environment approval.
3. Make high/critical dependency findings blocking.
4. Add structural OpenAPI validation, MySQL integration tests, and smoke checks.

### P0-13: Privacy And Terms Are Placeholders

**Current issue**

- citizen privacy and terms pages state that full content will be published later.
- the platform collects exact GPS, evidence, device signals, contact data, and potentially vehicle plates.

**Impact**

- citizens cannot give informed consent.
- launch presents significant trust and DPDP-readiness risk.

**Required solution**

1. Publish reviewed privacy notice and terms before pilot.
2. Explain purposes, retention, agencies, processors, evidence access, rights, and grievance contact.
3. Add contextual notices at GPS, camera, anonymous, and public-map steps.
4. Maintain a processor and data-retention register.

### P0-14: Plaintext Integration And Notification Credentials

**Current issue**

- integration and notification credentials use normal JSON casts.
- some edit/toggle flows can write masked values back or clear secrets.

**Impact**

- a database leak exposes service credentials.
- normal admin edits can destroy working credentials.

**Required solution**

1. Migrate credentials to encryption-compatible columns with encrypted casts or a secret manager.
2. Implement preserve-on-blank semantics.
3. Never return secret placeholders as writable values.
4. Add credential-rotation audit and health validation.

### P0-15: Suspended Users Can Still Authenticate Or Refresh

**Current issue**

- account status checks are not consistently enforced in OTP, password, and refresh flows.

**Impact**

- suspension may not terminate access.

**Required solution**

1. Enforce active status in authentication and protected middleware.
2. Revoke all access and refresh tokens on suspension.
3. Add suspended-user login and refresh denial tests.

---

## 8. P1 Citizen And Public Experience Findings

### P1-01: Missing Idempotency On Citizen Submission

The frontend does not send a durable idempotency key, and the backend middleware reserves keys too late to stop concurrent side effects.

**Solution:** use the client draft UUID as an idempotency key; atomically reserve it before execution; scope by principal, method, and route; replay only the completed matching response.

### P1-02: Tracking Number Is Replaced By Invented UI References

The backend returns `CIV-*`, but citizen list/detail screens construct unrelated `CIP-*` or `REF-*` values.

**Solution:** add `tracking_number` to citizen types and use it everywhere, including SMS, support, duplicate links, and exports.

### P1-03: Anonymous Reporting Is Incomplete

Routes require authentication; anonymous reports lose ownership; media upload and tracking become unusable.

**Solution:** first decide whether anonymous means hidden identity or no account. Prefer authenticated confidential reporting for most categories. If true anonymous reporting is required, issue a tracking secret and recovery code, isolate sensitive categories, and define notification limitations.

### P1-04: Timeline Marks The Oldest Event As Current

Backend history order and frontend current-item assumptions conflict.

**Solution:** return explicit ordering and `is_current`, or sort newest-first in the resource and test resolved/closed timelines.

### P1-05: Citizen Status Filters Misclassify Reports

Accepted, rejected, merged, and unknown states can appear under Resolved.

**Solution:** define central lifecycle groups (`open`, `awaiting_citizen`, `closed`, `rejected`, `merged`) from executable workflow metadata, not negative lists in the component.

### P1-06: No Citizen Verification Or Reopening

The executable workflow allows department closure without citizen verification, and no citizen action endpoint exists.

**Solution:** add `resolved_pending_verification`, `verified`, `reopened`, and supervisor-review transitions; expose proof and a time-bound dispute action.

### P1-07: Merged Reports Become Dead Ends

Canonical report metadata is stored but not exposed to citizens.

**Solution:** return canonical tracking number and link; preserve the supporter relationship; continue notifications from the canonical case; allow incorrect-merge dispute.

### P1-08: Citizen API And Frontend Detail Types Do Not Match

The frontend expects assigned department, media count, and AI summary fields absent from `ReportResource`.

**Solution:** define a versioned citizen report detail resource and generate/validate TypeScript types against the API contract.

### P1-09: Verification Badge Is Misleading

`is_verified` is displayed prominently, but application code does not drive it reliably and the verified state is unreachable.

**Solution:** remove the badge until a real citizen-verification workflow exists, then derive it from lifecycle state and verification event.

### P1-10: Evidence Rules Are Not Enforced End To End

The UI uses hard-coded limits while backend finalization does not enforce report-type requirements.

**Solution:** expose evidence requirements with report types; validate client-side for guidance and server-side for authority; include video duration and asset readiness.

### P1-11: Citizens Can Add Evidence After Submission

Media authorization checks ownership but not lifecycle status.

**Solution:** allow evidence modification only in draft or explicit request-for-more-information states; preserve chain of custody through append-only evidence revisions.

### P1-12: Capture Metadata Is Lost

Captured timestamp, provider, device context, and useful GPS metadata are not persisted consistently.

**Solution:** define a privacy-reviewed metadata schema; store capture timestamp, upload timestamp, accuracy, and source; do not rely blindly on client EXIF.

### P1-13: GPS Quality Message Contradicts Backend Validation

The UI accepts accuracy that the server rejects.

**Solution:** share the configured threshold; block progression or offer map-pin correction; explain how to improve accuracy.

### P1-14: Bengaluru Ward And Jurisdiction Are Not Resolved

Location persistence does not populate ward or district, while routing rules depend on those fields.

**Solution:** load authoritative GIS boundaries; run point-in-polygon enrichment; model agency service areas; route unresolved boundaries to an explicit jurisdiction-review queue.

### P1-15: Exact GPS Is Sent To An Undeclared Third Party

Browser reverse geocoding sends precise coordinates to an external Overpass host, while the notice says GPS is used only for routing.

**Solution:** proxy geocoding through an approved connector, disclose the processor, cache results, enforce retention, and avoid appending Bengaluru to out-of-area results.

### P1-16: PWA Paths Are Incorrect

Manifest and service-worker paths use `/cip/*` while the citizen portal is `/citizen/*`.

**Solution:** align start URL, scope, shortcuts, offline shell, and push URLs to `/citizen`; add install-mode E2E coverage.

### P1-17: Production Offline Reads Do Not Work Cross-Origin

The service worker ignores API requests on the production API origin.

**Solution:** cache an explicit allowlist of safe GET responses or serve through a same-origin gateway; never cache authenticated responses without account-scoped keys and expiry.

### P1-18: Offline Retry Is Incomplete

No background sync is registered on enqueue; future retry times have no timer; app closure stops delivery.

**Solution:** use Background Sync where available, app-level retry scheduling elsewhere, resumable uploads, visible failure reasons, and manual retry/edit/delete.

### P1-19: Completed Queue Items Remain Counted

Done entries remain and `size()` counts all statuses.

**Solution:** count only actionable statuses, remove acknowledged entries after a retention window, and expose failed/dead items separately.

### P1-20: Refresh Tokens And Server Logout Are Not Used

The frontend discards refresh tokens and logout only clears local storage.

**Solution:** choose a secure session architecture, preferably HttpOnly same-site cookies for refresh/session where deployment permits; rotate refresh tokens; call server logout; stop offline processing on expiry.

### P1-21: Browser Security Headers Are Incomplete

Production lacks CSP and HSTS, increasing the impact of localStorage tokens and XSS.

**Solution:** add CSP in report-only mode, then enforce; add HSTS, secure proxy/IP configuration, and dependency scanning.

### P1-22: No Durable Offline Draft

Refresh, crash, or browser eviction loses in-progress report state.

**Solution:** persist account-scoped drafts, step progress, location, and media handles; show storage usage; allow resume and discard.

### P1-23: Public Heatmap Privacy Is Too Weak

Cells with one report can be returned.

**Solution:** use ward/service-zone aggregation, minimum group threshold such as `k >= 5`, delayed publication for sensitive categories, and freshness/definition metadata.

---

## 9. P2 Citizen And Public Experience Findings

### P2-01: Category Selection Is Not Searchable Or Fully Configurable

**Solution:** API-driven categories with localized labels, aliases, common-first ranking, search, examples, and an explicit Other/Needs routing option.

### P2-02: Description Is Mandatory Despite Specification Conflict

**Solution:** resolve the product rule; prefer photo plus short issue label, with optional voice/text detail for low-literacy and time-sensitive reporting.

### P2-03: Search, Filters, Sorting, And Pagination Are Incomplete

**Solution:** server-side filtering by tracking number, category, status, area, and date; cursor pagination; URL state; accurate filtered totals.

### P2-04: Failures Are Displayed As Empty States

**Solution:** separate loading, empty, stale, offline, authorization, and network-error states on Home, Notifications, Profile, and Reports.

### P2-05: Settings Is Hard To Reach And Profile Logout Was Nonfunctional

**Solution:** include Settings in navigable information architecture; provide working logout, notification controls, language, privacy, and data-management actions.

### P2-06: First-Time Profile Completion Is Missing

**Solution:** add accessible onboarding for preferred name, language, notification channel, and optional email; do not require a civic-office visit for routine edits.

### P2-07: No Localization Foundation

**Solution:** introduce message catalogs, `en-IN` and `kn-IN`, localized report-type fields, template locales, and language-aware date/number formatting before adding more hard-coded strings.

### P2-08: Accessibility Gaps

**Solution:** focus step headings, announce transitions/errors, add skip links, respect reduced motion, provide textual map alternatives, maintain 44px targets, and run axe plus screen-reader/manual checks.

### P2-09: Video Evidence Usability Is Weak

**Solution:** preview, duration countdown, auto-stop, retry, compression progress, and clear required/optional guidance; revoke object URLs.

### P2-10: Issue Location Is Assumed To Equal Reporter Location

**Solution:** initialize from GPS but allow a movable issue pin; preserve reporter capture coordinate separately; warn about unsafe capture and large distance differences.

### P2-11: Public Metrics Can Mislead

**Solution:** publish metric definitions; exclude rejected/merged duplicates where appropriate; persist AI classification correctly; show data freshness and denominator.

### P2-12: Landing Page Prioritizes Internal Demo Portals

**Solution:** production landing should lead with resident service, public tracking, service area, emergency guidance, and language. Staff portals should use a separate staff entry point.

### P2-13: No Emergency Or Unsupported-Agency Diversion

**Solution:** before evidence capture, state that emergencies require 112/appropriate services; provide alternative agency contacts when the issue is outside supported scope.

### P2-14: Citizen Product Analytics Are Missing

**Solution:** instrument OTP delivery, report start/completion, step abandonment, GPS errors, media failure, offline queue age, notification delivery, reopen rate, accessibility, and performance without collecting unnecessary PII.

### P2-15: Mobile Browser Coverage Is Inadequate

**Solution:** add Playwright mobile projects and real-device testing for Android Chrome, Samsung Internet, iOS Safari, camera/GPS permission recovery, installed PWA, and constrained network profiles.

---

## 10. Moderator, Department, And Admin Workflow Findings

### WF-01: Lifecycle Has Unreachable And Dead-End States

- `verified` has no incoming executable transition.
- `escalated` has no reliable exit.
- resolved can close without citizen verification.

**Solution:** define one canonical lifecycle with explicit owners, allowed actors, SLAs, citizen verification, reopening, and supervisor escalation.

### WF-02: Assignment Invariants Can Be Bypassed

Moderator assignment paths can create assigned reports without a primary assignment row. Department actions do not update assignment timestamps/task state consistently.

**Solution:** route every assignment through `AssignmentService`; enforce one active primary assignment; update report and assignment atomically.

### WF-03: Secondary Agencies Have Excess Lifecycle Authority

Broad visibility can permit secondary assignments to perform primary lifecycle actions.

**Solution:** primary agency owns report lifecycle; secondary agencies own task lifecycle only; closure waits for required dependencies or an audited override.

### WF-04: Closure Does Not Require Adequate Proof

**Solution:** configurable proof requirements, assignment-owned evidence, location/time validation, notes, dependency completion, and citizen-visible summary.

### WF-05: Workflow Editor Can Damage Configuration

Frontend and backend disagree about transition identifiers and replacement behavior; omitted metadata can reset silently.

**Solution:** disable destructive editing until contract tests exist; use DTOs with full round-trip fidelity; version workflows; validate graph reachability; preview diff before publish; support rollback.

### WF-06: Admin Settings Do Not Control Runtime

Examples include moderator requirements, scheduler pause state, channel config, duplicate radius, and fraud thresholds.

**Solution:** maintain a setting-to-consumer registry; add runtime contract tests; hide or label settings that are not implemented.

### WF-07: Credential Editors Can Destroy Secrets

**Solution:** preserve on blank, separate rotate-secret action, encrypted storage, no masked-value resubmission, and audit every rotation.

### WF-08: Connector Framework Is Not Implemented

Current integrations are CRUD plus URL reachability.

**Solution:** implement connector contracts, registry, mapping, transactional outbox, queued execution, idempotency, retries, circuit breaker, signatures, request log, reconciliation, and DLQ before claiming live agency integration.

### WF-09: Duplicate/Fraud Queues Lack Provenance

Scores are shown without complete candidate/reason context.

**Solution:** persist duplicate candidates and evidence; show distance, time, image/text similarity, canonical report, reason codes, and affected citizens.

### WF-10: SLA Enforcement Is Disconnected From Assignments

Current checks are unbounded, status-history based, and lack working calendars or deduplicated escalation.

**Solution:** persist indexed `sla_due_at`; use agency calendars; evaluate only open overdue work; record one breach; escalate through a configured matrix.

### WF-11: Multi-Agency Coordination Is Incomplete

Fixed secondary-routing triggers do not cover enough Bengaluru scenarios, and primary closure can ignore open linked tasks.

**Solution:** model primary case plus typed agency tasks and dependencies; support acknowledgement, handoff SLA, blocking/non-blocking tasks, and reconciliation.

### WF-12: Analytics Labels Overstate What Is Measured

AI accuracy and operations periods do not match their labels.

**Solution:** define metrics mathematically; calculate server-side over selected periods; publish denominators, exclusions, and freshness.

### WF-13: RBAC Is Inconsistent

Portal access, policies, and service checks disagree for auditors, system users, and department roles.

**Solution:** central role-capability matrix; route middleware plus policies; frontend capability payload; denial tests for every mutation.

### WF-14: Audit Can Duplicate Successes And Miss Exceptions

**Solution:** define one audit ownership model; capture attempted mutations in exception paths; use idempotency keys; enforce append-only database permissions.

### WF-15: OpenAPI Is Structurally Invalid

**Solution:** repair top-level paths/components structure; generate or validate schema structurally in CI; use contract tests rather than substring assertions.

### WF-16: Field-Officer Experience Needs Operational Tools

**Solution:** add route optimization, offline task mode, quick progress templates, equipment/resource requests, dependency visibility, and safe proof capture.

---

## 11. Backend Performance, Security, And Operations Findings

### BE-01: Refresh Token Lookup Does Not Scale And Rotation Races

**Solution:** indexed random selector plus hashed verifier; transaction and row lock during rotation; one child per parent; family revocation.

### BE-02: Idempotency Does Not Stop Concurrent Side Effects

**Solution:** reserve pending key before handler execution; lock replays; include principal/method/route/request hash; store response after commit.

### BE-03: Tracking Number Allocation Is Race-Prone

**Solution:** use an atomic yearly sequence/counter table under lock and wrap final submission in one transaction.

### BE-04: Workflow Evaluation And Application Can Lose Updates

**Solution:** lock report row, assert expected source state, apply transition and assignment in one transaction, and consider optimistic version columns.

### BE-05: Cross-Agency Evidence Is Not Isolated

**Solution:** attach proof to assignment/task and agency; enforce in query, policy, signed URL, and access logs.

### BE-06: AI Labels Are Not Persisted For Routing/Public Metrics

**Solution:** persist canonical label and result atomically; test `ai_label_in` routing and classified-percentage metrics.

### BE-07: Large Evidence Is Repeatedly Loaded Into PHP Memory

**Solution:** direct multipart object-store upload, streaming hash/scan, presigned provider URL, asynchronous metadata extraction, and explicit memory/concurrency limits.

### BE-08: Media Serving Is Not Storage-Agnostic

**Solution:** centralize through `MediaUrl`; proxy local disk only; use native presigned URLs for object storage; test MinIO/S3 paths.

### BE-09: Hot Report APIs Have N+1 Queries And Oversized Pages

**Solution:** explicit eager-load projections, separate list/detail resources, query-count tests, and page caps around 50-100.

### BE-10: Report Search Will Degrade To Table Scans

**Solution:** exact/prefix tracking search, MySQL FULLTEXT or search service for text, cursor pagination, and composite indexes validated with production-shaped `EXPLAIN ANALYZE`.

### BE-11: SLA Job Is Unbounded

**Solution:** indexed `sla_due_at`, query only open overdue records, idempotent breach rows, and downstream notification/escalation listeners.

### BE-12: Notification Listeners Are Registered More Than Once

**Solution:** one provider owns registration; use event/delivery idempotency keys; test one notification per lifecycle event.

### BE-13: Integration Health Probe Enables SSRF

**Solution:** validate scheme/host/port, resolve and reject private/link-local/metadata addresses, run asynchronously through restricted egress, and record probe audit.

### BE-14: Retention Is Incomplete And Conflicts With Audit Guarantees

**Solution:** legal holds, chunked deletion, evidence-byte lifecycle, custody records, append-only audit policy, dry-run report, and approval workflow.

### BE-15: Public Analytics Are Expensive And Privacy-Weak

**Solution:** scheduled aggregate tables, ward-level facts, suppression threshold, bounded date windows, and cache/version metadata.

### BE-16: Health Checks Can Report False Readiness

Queue size zero does not prove a worker exists; registered schedules do not prove a scheduler runs.

**Solution:** worker and scheduler heartbeats, oldest-job age, last-success timestamps, dependency checks, and sanitized public readiness output.

### BE-17: Observability Is Insufficient

**Solution:** centralized structured logs, trace IDs across jobs/connectors, metrics, error tracking, queue/SLA dashboards, alerts, and incident runbooks.

### BE-18: Dependency Vulnerabilities Are Non-Blocking

**Solution:** update affected npm/Composer dependencies, maintain an exception policy with expiry, and block high/critical findings.

### BE-19: Production Source Maps And Headers Need Review

**Solution:** disable public source maps unless explicitly required, add CSP/HSTS, and configure trusted proxies to preserve accurate audit/rate-limit IPs.

---

## 12. Maintainability And Industry-Standards Findings

### 12.1 Objective Hotspots

At assessment time:

| Metric | Observation |
|---|---:|
| Tracked files | 1,035 |
| Backend production PHP | approximately 34,666 lines |
| Backend tests | approximately 26,441 lines across 231 files |
| Frontend production TS/TSX | approximately 24,805 lines |
| Portal page components | 50 |
| Portal pages without direct colocated tests | 28 |
| Portal pages above 500 lines | 7 |
| Hard-coded hex occurrences | approximately 2,015 |
| Imports from `moderator/design` outside moderator | 43 files |
| Direct `::query()` calls in controllers | approximately 75 |
| Controllers above the documented 150-line limit | 12 of 42 |

Large files include:

- `frontend/src/portals/admin/api/client.ts` at more than 1,100 lines.
- `frontend/src/portals/citizen/pages/SubmitPage.tsx` at more than 1,000 lines.
- moderator and operations report detail pages at approximately 770 lines each.
- `frontend/src/portals/admin/pages/AdminAi.tsx` at more than 700 lines.
- `backend/app/Modules/AI/Jobs/AiPipelineOrchestrator.php` at more than 600 lines.
- `ReportsController.php` at more than 400 lines.

### MAINT-01: Shared UI Is Owned By The Moderator Portal

Admin, citizen, auth, and public code import `moderator/design`, while operations keeps duplicate primitives.

**Solution:** move neutral primitives to `frontend/src/shared/ui`; migrate one component at a time without restyling; remove byte-identical operations copies.

### MAINT-02: Visual Tokens Are Hard-Coded

**Solution:** centralize CSS variables for canvas, surfaces, ink, secondary text, borders, semantic states, radius, spacing, focus, and elevation. Tailwind utilities should reference those tokens.

### MAINT-03: Page Components Own Too Many Responsibilities

**Solution:** extract feature hooks and meaningful sections, not dozens of tiny components. Keep route pages as data/loading/error coordinators.

Recommended citizen submission structure:

```text
frontend/src/features/report-submission/
  ReportSubmissionPage.tsx
  useReportSubmission.ts
  validation.ts
  draftStore.ts
  steps/
    CategoryStep.tsx
    DetailsStep.tsx
    LocationStep.tsx
    EvidenceStep.tsx
    ReviewStep.tsx
```

### MAINT-04: Admin API Client Is Monolithic

**Solution:** split by resource while preserving public hook names and query keys.

```text
frontend/src/portals/admin/api/
  client.ts
  users.ts
  roles.ts
  departments.ts
  reports.ts
  integrations.ts
  notifications.ts
  ai.ts
  routing.ts
  workflows.ts
  settings.ts
```

### MAINT-05: Frontend API Clients Disagree

Auth, moderator, and operations have different envelopes, errors, environment names, unwrapping, and 401 behavior.

**Solution:** create one shared transport, typed envelope/error, refresh/logout behavior, multipart upload API, and download API. Keep portal-specific resource functions above it.

### MAINT-06: Controllers Violate The Orchestration-Only Standard

**Solution:** split by use case, move persistence to repositories, decisions to services, authorization to policies/middleware, and storage delivery to a media service.

Suggested report controller structure:

```text
backend/app/Modules/Reports/Http/Controllers/Api/
  ReportSubmissionController.php
  CitizenReportController.php
  StaffReportController.php
  ReportTypeController.php
```

### MAINT-07: AI Job Contains Too Much Domain Logic

**Solution:** keep the queued job thin and extract pipeline runner, evidence resolver, provider execution, duplicate/fraud analysis, and atomic result writer.

### MAINT-08: CI Runs Too Narrow A Test Selection

Source changes can merge without related tests if no test file changed.

**Solution:** map source paths to relevant test suites, add nightly full MySQL tests, run critical Playwright journeys, and ratchet static-analysis baselines.

### MAINT-09: Static Quality Debt Is Hidden

**Solution:** record current PHPStan/ESLint/Pint/Prettier baselines; fail on new violations; reduce module by module; never regenerate a broad baseline to hide regressions.

### MAINT-10: Architecture Documentation Is Stale

Docs still reference Flutter and PostgreSQL/PostGIS in places while executable stack uses React and MySQL.

**Solution:** update architecture and deployment documents; add concise module READMEs, sequence diagrams, configuration contracts, and ownership.

### MAINT-11: Direct Production Deployment Makes Refactoring Unsafe

**Solution:** release branches/tags, CI gate, staging, approval, immutable deployment, rollback, and database compatibility policy.

### MAINT-12: Test Volume Does Not Equal Journey Confidence

**Solution:** prioritize contract and critical-flow tests: OTP, draft/upload/finalize, duplicate support, assignment, resolution proof, citizen dispute, notification delivery, offline resume, and production config.

---

## 13. Recommended Target Architecture

### 13.1 Keep The Existing Stack

Do not rewrite the platform in Node, Django, React Native, PostgreSQL, or another stack solely because comparison systems use them.

Retain:

- Laravel 12 and PHP 8.4.
- React 19 and TypeScript.
- MySQL 8.4.
- Redis.
- S3-compatible object storage.
- queued jobs and scheduled tasks.

Improve the boundaries and operational implementation.

### 13.2 Transactional Submission

```text
Citizen draft
  -> resumable evidence upload
  -> evidence-ready validation
  -> ReportSubmissionService transaction
     -> tracking sequence
     -> report + location + media links
     -> workflow transition
     -> audit
     -> outbox event
  -> async hash/AI/routing
```

### 13.3 Transactional Outbox

Use an outbox table for:

- notification events.
- connector dispatch.
- analytics facts.
- search indexing.
- public aggregate updates.

This prevents database state from committing without its required asynchronous side effect.

### 13.4 Connector Boundary

```text
backend/app/Modules/Integrations/
  Contracts/
    ConnectorInterface.php
  Connectors/
    RestConnector.php
    SoapConnector.php
    WebhookConnector.php
  Authentication/
  Mapping/
  Jobs/
    DispatchConnectorRequest.php
    ReconcileConnectorRequest.php
  Services/
    ConnectorManager.php
    RetryPolicy.php
    DeadLetterService.php
  Models/
    ConnectorRequest.php
    ConnectorAttempt.php
  Events/
```

Every connector requires timeout, retry, idempotency, correlation ID, audit, health, signature validation, reconciliation, and DLQ.

### 13.5 GIS Enrichment

Maintain versioned authoritative boundaries for:

- municipal corporation/ward.
- BBMP engineering and solid-waste zones.
- BWSSB service areas.
- BESCOM subdivisions.
- BTP traffic divisions.
- supported BDA/PWD/BMRCL/BMTC jurisdictions where applicable.

Store boundary dataset version on each routing decision so future ward changes do not rewrite history.

### 13.6 Notification Architecture

```text
Domain event
  -> typed notification intent
  -> template contract validation
  -> preference/contact selection
  -> delivery rows per channel
  -> channel-specific jobs
  -> retry/DLQ/receipt
```

### 13.7 SLA Architecture

Persist:

- acknowledgement deadline.
- work deadline.
- citizen-verification deadline.
- current SLA state.
- breach timestamp.
- escalation level.
- calendar/version used.

Query indexed deadlines instead of scanning all reports.

### 13.8 Privacy-Safe Public Data

Public data should use:

- ward/service-zone aggregates.
- minimum group thresholds.
- masked identities.
- delayed/suppressed sensitive categories.
- metric definitions and freshness.
- stable open-data schema and versioning.

---

## 14. Recommended Features By Priority

### Before Public Pilot

1. Real OTP and secure sessions.
2. Atomic draft/upload/finalize flow.
3. Account-scoped offline drafts.
4. Correct tracking number everywhere.
5. Reliable SMS/in-app lifecycle notifications.
6. GIS ward and agency resolution.
7. Assignment acknowledgement and SLA.
8. Verifiable closure proof.
9. Citizen dispute/reopen.
10. Production queue/scheduler/cache/scan/backup/CI repair.
11. Legal/privacy content.
12. Security authorization fixes.

### During Limited Ward Pilot

1. Nearby duplicate discovery and support/upvote.
2. Canonical merged-report tracking.
3. Kannada and English UI/templates.
4. Assisted-reporting workflow.
5. WhatsApp intake through the connector framework.
6. Field-officer offline task mode.
7. Equipment/resource request subtasks.
8. Public ward metrics and open-data export.
9. Satisfaction survey and closure-quality dashboard.
10. Mobile real-device testing and accessibility remediation.

### After Reliable Baseline

1. Before/after visual comparison as a moderator signal.
2. Evidence-quality model.
3. Predictive maintenance based on repeated locations/assets.
4. Field route optimization.
5. Neighborhood subscriptions.
6. Privacy-safe community verification.
7. Proactive hotspot and recurring-defect work orders.

---

## 15. Ideas To Avoid Or Defer

1. **Do not use blockchain for audit.** An append-only audit model, database permissions, signed hashes, backups, and external log retention are sufficient and easier to operate.
2. **Do not let AI auto-close or auto-reject citizen reports.** AI should recommend and flag.
3. **Do not publish exact citizen GPS.** Aggregate and suppress sparse data.
4. **Do not expose officers' personal phone numbers.** Use official contact routing or masked/system numbers.
5. **Do not force video for every category.** Configure evidence requirements by issue type and network/device constraints.
6. **Do not build a native app before the PWA flow is reliable.** A native rewrite would duplicate unresolved business and backend defects.
7. **Do not add public leaderboards based only on closure count.** They can incentivize false closure. Use citizen-confirmed resolution, reopen rate, SLA, and quality together.
8. **Do not expose admin controls that runtime ignores.** Either connect them to executable behavior or label them unavailable.
9. **Do not integrate agencies through synchronous controller HTTP calls.** Use connectors and outbox jobs.
10. **Do not perform a broad refactor before characterization tests.** Preserve routes, status codes, query keys, and public contracts while extracting.

---

## 16. Phased Delivery Plan

### Phase 0: Freeze Contracts And Measure

**Work**

- Characterization tests for API envelopes, lifecycle, roles, queues, and config.
- Baseline production configuration checks.
- Record static-analysis and dependency baselines.
- Define canonical lifecycle and agency ownership model.
- Define privacy, anonymous, assisted, and public-data policy.

**Exit criteria**

- Decisions are approved.
- Critical flows have tests before structural changes.

### Phase 1: Production Safety

**Work**

- OTP, debug removal, rate limits.
- internal AI and admin authorization.
- Redis routing/cache.
- worker queues and scheduler.
- malware-scanner health.
- CI/deploy gate.
- backups, rollback, and restore drill.
- secret encryption and SSRF controls.

**Exit criteria**

- no known P0 security/configuration issue.
- required workers and scheduler show fresh heartbeats.
- a restore drill succeeds.

### Phase 2: Submission Correctness

**Work**

- account-scoped durable drafts.
- resumable evidence upload.
- idempotent atomic finalization.
- tracking number consistency.
- evidence requirements and metadata.
- unique hash-ready AI orchestration.
- correct citizen detail resource.

**Exit criteria**

- network interruption cannot create a duplicate or evidence-less official report.
- shared-device queue tests pass.

### Phase 3: Trustworthy Resolution

**Work**

- primary/secondary assignment invariants.
- assignment acknowledgement and indexed SLA.
- before/after proof.
- citizen verification/dispute/reopen.
- merged-report continuity.
- typed, reliable notifications.

**Exit criteria**

- every closure has proof, actor, assignment, and citizen-visible outcome.
- every dispute reaches a supervisor queue.

### Phase 4: Bengaluru Pilot Readiness

**Work**

- GIS jurisdiction enrichment.
- Kannada/English.
- emergency and unsupported-agency diversion.
- assisted reporting.
- public privacy-safe metrics.
- mobile/browser/accessibility matrix.
- controlled pilot in a small set of representative wards.

**Exit criteria**

- pilot agencies accept routing and escalation responsibilities.
- measured submission, SLA, notification, and closure-quality targets are met.

### Phase 5: Scale And Interoperability

**Work**

- connector framework and real agency integrations.
- open-data/API publication.
- materialized analytics.
- route optimization.
- advanced duplicate/evidence intelligence.
- capacity/load testing and incident exercises.

**Exit criteria**

- agency integrations reconcile automatically.
- queue, API, media, and AI capacity meet tested peak assumptions.

### Phase 6: Maintainability Ratchet

This runs alongside all phases:

- shared UI/API extraction.
- page/controller decomposition.
- PHPStan/ESLint/Pint/Prettier baseline reduction.
- module documentation.
- direct tests for currently uncovered pages.
- dependency updates.
- removal of stale contracts and dead configuration.

---

## 17. Production Metrics And Service Objectives

### Citizen Journey

| Metric | Initial target |
|---|---:|
| OTP delivery success | >= 98% |
| OTP p95 delivery time | <= 30 seconds |
| Started reports completed | >= 75% |
| Median active submission time | <= 3 minutes |
| Required evidence upload success | >= 98% |
| Offline drafts recovered successfully | >= 99% |
| Duplicate official submissions from retry | 0 |

### Workflow

| Metric | Initial target |
|---|---:|
| Assignment acknowledgement within target | >= 95% |
| Lifecycle notifications delivered | >= 95% |
| Reports with valid closure proof | 100% |
| Citizen-confirmed resolution | measured separately from closure |
| Reopen/dispute rate | monitor by category, ward, and officer |
| False/invalid closure rate | < 2% after pilot stabilization |
| Handoffs acknowledged within SLA | >= 95% |

### Reliability

| Metric | Initial target |
|---|---:|
| API availability | >= 99.9% during pilot service hours |
| Oldest critical queue job | < 2 minutes under normal load |
| Scheduler heartbeat age | < 2 minutes |
| Failed jobs without alert | 0 |
| Backup success | 100% |
| Restore drill | recurring and documented |
| Critical authorization regressions | 0 |

### Experience And Inclusion

| Metric | Initial target |
|---|---:|
| WCAG 2.2 AA critical violations | 0 |
| Kannada/English journey parity | 100% for pilot flows |
| Mobile crash-free sessions | >= 99.5% |
| Citizen satisfaction after verified resolution | >= 70% pilot baseline |
| Reports requiring support due to status confusion | declining trend |

---

## 18. Required Product And Governance Decisions

Implementation should not invent these policies:

1. Is description optional?
2. Which report types require photos or video?
3. What is the canonical lifecycle, including verified/reopened/escalated?
4. How long is the citizen dispute window?
5. Can reports auto-close after no citizen response?
6. What constitutes acceptable closure proof per category?
7. What does anonymous reporting mean operationally?
8. Which categories allow anonymity?
9. What agencies and service boundaries are in pilot scope?
10. Which agency owns border disputes?
11. Which secondary tasks block primary closure?
12. What official SLA and working calendar applies per category/agency?
13. What public data is released and at what aggregation threshold?
14. Which languages are required for pilot?
15. What assisted-reporting organizations and roles are authorized?
16. Which notification channels are official and legally approved?
17. What is the legal retention period for reports, evidence, audit, device signals, and notification logs?

---

## 19. Existing Strengths To Preserve

- Strict PHP types across module code.
- Domain modules with services, repositories, requests, resources, policies, events, and jobs.
- Workflow engine and audit concepts.
- Signed evidence URL and custody concepts.
- Server-side MIME/signature validation.
- TypeScript strict mode.
- Substantial unit and feature test volume.
- Trace IDs in API errors.
- Explicit production CORS.
- Docker development services for MySQL, Redis, MinIO, workers, scheduler, and Nginx.
- Clear citizen, moderator, operations, admin, and public portal separation.
- Established warm, accessible visual direction.

---

## 20. Research Sources

### Bengaluru And Karnataka

- Karnataka Government App Store, Namma Bengaluru/Sahaaya listing: https://apps.karnataka.gov.in/app/87/en
- Google Play, Namma Bengaluru (Sahaaya 2.0): https://play.google.com/store/apps/details?id=com.nammabengaluruNew.org
- OpenCity, "Decoding Bengaluru's Civic Complaints" (2025): https://opencity.in/decoding-bengalurus-civic-complaints-a-deep-dive-into-bbmp-grievances-data-2025/
- Times of India, BBMP Sahaaya 2.0 complaint-resolution failures (2024): https://timesofindia.indiatimes.com/city/bengaluru/bengalurus-bbmp-sahaaya-20-app-fails-to-address-civic-complaints/articleshow/115392024.cms
- Deccan Herald, Bengaluru civic grievance system assessment: https://www.deccanherald.com/india/karnataka/bengaluru/bengaluru-civic-bodys-sahaaya-grievance-system-helps-but-can-be-better-2793634
- Citizen Matters, Bengaluru civic complaint and accountability analysis: https://citizenmatters.in/bengaluru-civic-issues-complaint-fix/
- New Indian Express, BBMP single-app announcement (2025): https://www.newindianexpress.com/cities/bengaluru/2025/Apr/01/bbmp-to-launch-single-app-for-civic-complaints

### Comparison Platforms

- FixMyStreet: https://www.fixmystreet.com/
- FixMyStreet platform documentation: https://fixmystreet.org/
- mySociety FixMyStreet: https://www.mysociety.org/community/fixmystreet/
- NYC 311: https://portal.311.nyc.gov/
- NYC Open Data: https://data.cityofnewyork.us/
- Boston 311: https://www.boston.gov/departments/boston-311
- Boston 311 open data: https://data.boston.gov/dataset/311-service-requests
- SeeClickFix: https://seeclickfix.com/
- CivicPlus SeeClickFix 311 CRM: https://www.civicplus.com/seeclickfix-311-crm/

### Internal Sources

- `docs/01-Product-Vision.md`
- `docs/02-PRD.md`
- `docs/03-System-Architecture.md`
- `docs/04-Database-Design.md`
- `docs/05-REST-API-Specification.md`
- `docs/06-Citizen-PWA-Specification.md`
- `docs/07-Moderator-Portal-Specification.md`
- `docs/08-Department-Portal-Specification.md`
- `docs/09-Super-Admin-Portal-Specification.md`
- `docs/10-AI-and-Vision-Engine-Specification.md`
- `docs/11-Security-and-Anti-Fraud-Specification.md`
- `docs/12-External-API-Connector-Framework.md`
- `docs/13-UI-Design-System.md`
- `docs/14-DevOps-and-Deployment.md`
- `docs/15-QA-and-Test-Strategy.md`

---

## 21. Immediate Recommended Next Step

Create implementation issues only for Phase 0 and Phase 1 first. The first engineering batch should contain:

1. Disable production debug OTP and restore secure rate limits.
2. Add internal AI and prompt-action authorization.
3. Repair production worker queues, Redis cache, scheduler, and scanner health.
4. Gate deployment on CI and production approval.
5. Add verified three-domain backups and rollback.
6. Add characterization tests for report submission, evidence readiness, idempotency, notifications, lifecycle, and authorization.

Do not start advanced AI, public leaderboards, predictive maintenance, or a native app until these exit criteria are met.

---

## 22. Implementation Status Tracker

Status legend: **Done** = implemented and covered by tests in the current worktree; **Partial** = some layers shipped but not fully wired or rolled out; **Not started** = no code changes yet. Evidence paths point at the current worktree on branch `fix/moderator-view-all-affordance`.

### P0 — Production Safety

| ID | Status | Notes / Evidence |
|----|--------|------------------|
| P0-02 | **Done** | System role enforced on internal AI endpoints; admin role on prompt approve/rollback (`7234dbdd`). |
| P0-06 | **Done** | Notification template/listener wiring repaired (`efb5c131`). |
| P0-08 | **Done** | Worker queue + scheduler topology corrected and documented (`161148d1`). |
| BE-12 | **Done** | Notification listeners are registered only by `NotificationsServiceProvider`; duplicate registrations were removed from `AppServiceProvider`. |
| P0-05 | **Done** | Offline queue items and durable drafts carry a stable account owner; queue draining filters by owner, logout stops/clears the leaving account, and shared-device regressions cover isolation (`frontend/src/portals/citizen/offline/queue.ts`, `drafts.test.ts`). |
| P0-01 | **Not started (explicitly deferred)** | Real production OTP delivery remains intentionally excluded from this implementation pass per user instruction; current demo/mock OTP flow is unchanged. |
| P0-03 | **Done** | Citizen POST creates a draft; evidence manifest/hash readiness is enforced by `/reports/{id}/finalize`; legacy submit delegates to the same gate (`43d3f302`, `EvidenceFinalizationTest.php`). Local Pest is blocked by missing `pdo_sqlite`; CI MySQL is required. |
| P0-04 | **Done** | `ReportEvidenceReady` dispatches one revision-keyed, unique AI orchestration job after finalization; media-upload listener no longer starts AI early (`43d3f302`). |
| P0-05 | **Done** | Offline queue items and durable drafts carry a stable account owner; queue draining filters by owner, logout stops/clears the leaving account, and shared-device regressions cover isolation (`frontend/src/portals/citizen/offline/queue.ts`, `drafts.test.ts`). |
| P0-07 | **Done** | Browser Web Push subscription/VAPID registration and server delivery through stored subscriptions are wired; FCM device-token delivery remains supported, expired Web Push endpoints are pruned (`4c5ce9e2`, `082bac06`). Targeted Pest is blocked locally by missing `pdo_sqlite`; CI MySQL is required. |
| P0-09 | **Partial** | Production template requires Redis cache/phpredis; deploy and readiness probes verify Redis round-trip (`c82aed3e`, `39753c56`). cPanel must still provision ext-redis and pass a production routing smoke test. |
| P0-10 | **Partial** | Production deploy and `/health/ready` verify ClamAV executable/signatures and reject the `none` scanner (`c82aed3e`, `39753c56`); quarantine/operational recovery for scanner infrastructure failures still needs rollout. |
| P0-11 | **Partial** | Executable three-domain backup and guarded rollback scripts include database/evidence/code/App-Key integrity checks (`deploy/production/*`, `docs/production-rollback-runbook.md`, `c82aed3e`); immutable off-host retention, restore drills, and atomic release switching remain ops work. |
| P0-12 | **Partial** | Production workflow runs only after successful CI, references a protected production environment, and performs pre-rsync backup/capability checks (`.github/workflows/deploy-production.yml`, `c82aed3e`); GitHub environment approval rules must still be enabled in repository settings. |
| P0-13 | **Partial** | Privacy and Terms now contain substantive product copy and localization, but final legal/privacy-owner review remains required before publication. |
| P0-14 | **Done** | Integration and notification credential updates preserve omitted/masked secrets while encrypted casts remain authoritative (`d2df4696`). |
| P0-15 | **Done** | Login/refresh deny suspended, disabled, pending, and deleted users; refresh rotation and logout revocation have feature coverage. |

### P1 — Citizen And Public Experience

| ID | Status | Notes / Evidence |
|----|--------|------------------|
| P1-04 | **Done** | Detail timeline sorted newest-first; `is_current` supported in types and rendered with a latest fallback (`frontend/src/portals/citizen/types.ts:50`, `ReportDetailPage.tsx`). |
| P1-05 | **Done** | Central `lifecycleGroup` mapping (`open | awaiting_citizen | closed | rejected | merged`) backed by status constants, not component negative lists (`frontend/src/portals/citizen/types.ts`); regression tests reference P1-05. |
| P1-06 | **Done** | Authenticated `verify`/`dispute` routes are registered; workflow/service ownership and deadline checks are implemented; `CitizenReportResource` exposes deadline/proof media; citizen mutations and `CitizenResolutionCard` are wired into report detail with regression coverage. |
| P1-07 | **Done** | Canonical link and merge-dispute flow are wired end to end; `ReportsMergedListener` is registered; canonical status changes notify both the canonical owner and citizens whose reports remain linked through `merged_into`. |
| P1-08 | **Done** | Versioned `CitizenReportResource` emits exactly the citizen detail contract consumed by `frontend/src/portals/citizen/types.ts`. |
| P1-09 | **Done** | Misleading verification badge removed from citizen surfaces; resolution state derives from `lifecycleGroup`. |
| P1-17 | **Done** | Service worker accepts only an explicit public GET allowlist on `cip-api.dgisipl.com`; authenticated responses are never cached (`frontend/public/sw.js`). |
| P1-18 | **Partial** | Enqueue requests Background Sync, app-level retry timers schedule future attempts, and startup/online drains resume work; fully closed-app authenticated delivery still requires a secure SW session architecture. |
| P1-19 | **Done** | Queue size counts actionable statuses only; acknowledged `done` items are removed after retention and dead items remain separately actionable (`queue.ts`, queue regression tests). |
| P1-22 | **Done** | Report step progress, location, and media handles persist in an account-scoped IndexedDB draft and auto-resume; logout clears the leaving account draft (`drafts.ts`, `drafts.test.ts`). |
| P1-01 | **Done** | Citizen drafts now persist a stable submission key across browser crashes/restarts; the client sends it for draft creation and finalization, while middleware scopes replays by principal, route, and method (`2cc5086a`, `5160ee85`). Backend integration execution remains subject to CI MySQL verification. |
| P1-02 | **Done** | Citizen list/detail, canonical merge links, notifications, and exports use the server-issued `tracking_number` contract; no invented `CIP-*`/`REF-*` values remain in production surfaces. |
| P1-03 | Not started | Anonymous recovery/secret flow remains intentionally unimplemented because the product must first choose hidden-identity versus no-account semantics, allowed/sensitive categories, notification limits, expiry, and rate limits. Existing routes remain authenticated; no plaintext recovery secret is issued. |
| P1-10 | **Done** | Report-type requirements are exposed and server evidence manifest enforces required media, hashes, storage, and video readiness (`43d3f302`). |
| P1-11 | **Done** | Citizen media modification is restricted to draft/request-for-information lifecycle; lifecycle authorization regression test added (`dfabe1a8`). |
| P1-12 | **Done** | Browser capture forwards accuracy, altitude, heading, speed, provider, and captured timestamp into the location record; EXIF is not trusted blindly (`dfabe1a8`). |
| P1-13 | **Done** | Shared client GPS threshold (`100m`) blocks progression and matches backend `LocationAccuracy` (`89922433`). |
| P1-14 | **Partial** | MySQL point-in-polygon enrichment is implemented, but authoritative Bengaluru boundary data and unresolved-jurisdiction operations still need rollout. |
| P1-15 | **Done** | Reverse geocoding is proxied through `/public/geocode`, cached, timeout-limited, and browser-side direct Overpass access removed (`d2df4696`). |
| P1-16 | **Done** | Manifest, service-worker shell, scope, and shortcuts use `/citizen/*` (`f24ddc8e`). |
| P1-17 | **Done** | Service worker accepts only an explicit public GET allowlist on `cip-api.dgisipl.com`; authenticated responses are never cached (`c82aed3e`). |
| P1-18 | **Partial** | Enqueue requests Background Sync, app-level retry timers schedule future attempts, and startup/online drains resume work; fully closed-app authenticated delivery still requires a secure SW session architecture. |
| P1-19 | **Done** | Queue size counts actionable statuses only; acknowledged `done` items are removed after retention and dead items remain separately actionable (`queue.ts`, queue regression tests). |
| P1-20 | **Done** | Refresh tokens persist and rotate in the shared client; AuthContext performs best-effort server logout before clearing local state (`7993bf54`). |
| P1-21 | **Partial** | HSTS and CSP report-only are deployed at the web edge; enforcement/trusted-proxy rollout and API-host header verification remain operational tasks (`c82aed3e`). |
| P1-22 | **Done** | Report step progress, location, and media handles persist in an account-scoped IndexedDB draft and auto-resume; logout clears the leaving account draft (`drafts.ts`, `drafts.test.ts`). |
| P1-23 | **Done** | Public heatmap applies 24-hour delay and k>=5 suppression and exposes privacy/freshness metadata (`d2df4696`). |

### P2 — Usability

| ID | Status | Notes / Evidence |
|----|--------|------------------|
| P2-01 | **Done** | `CategoryPicker` is searchable and locale-aware; `ReportType` casts and validates `localizations`, `aliases`, and `sort_order`; `ReportTypeResource` and admin CRUD responses expose the complete contract with backend resource tests. |
| P2-04 | **Done** | Distinct loading/empty/error states across citizen pages; `DashboardPage`, `SubmitPage.states`, `PageStates.a11y` tests. |
| P2-05 | **Done** | `SettingsPage` reachable and routed; profile logout functional; `ProfilePage.test.tsx`. |
| P2-07 | **Done** | Reactive `en-IN`/`kn-IN` catalogs, persisted language selection, `<html lang>` updates, locale-aware dates, and localized layout/Home/Dashboard/Submit/Detail/Resolution/Notifications/Profile/Settings/legal/capture/category/merge-dispute surfaces are implemented with focused component/page coverage. |
| P2-02 | **Done** | Description is now optional in backend validation and citizen progression; short detail remains validated when supplied (`19d64fdb`). |
| P2-03 | **Partial** | Citizen service-request search now sends URL-persisted query, status, date, category, and area filters to the server, uses cursor-first navigation with stable URL cursors, and retains accessible previous/next controls (`59a1bb51`); production filter-query validation remains. |
| P2-08 | **Partial** | Reduced-motion CSS, focus/a11y scaffolding, styled touch targets, live-preview/timer accessibility, and public/citizen navigation affordances are covered (`aef9b0da`, `fe6abf08`, `c35fe43f`); a full axe, screen-reader, and manual keyboard pass remains. |
| P2-09 | **Partial** | Camera capture now exposes a live-preview label, non-spam timer, max-duration auto-stop, lifecycle-managed video previews, accessible recording progress, live announcements, keyboard retry, and attached-file feedback (`aef9b0da`, `154c9c85`, `fa14c5fe`); compression progress and broader device coverage remain. |
| P2-06 | **Done** | Citizen profile onboarding now captures preferred name, locale, and notification channel with validated PATCH persistence and an accessible completion/edit form (`401131e4`). |
| P2-10 | **Done** | Issue location is explicitly separated from reporter location through a manual-pin/map picker, provenance metadata, draft persistence, reporter-coordinate persistence, distance warning, and submit payload wiring (`401131e4`, `3198d702`). |
| P2-15 | **Partial** | Playwright now defines Chromium, Pixel 7, and iPhone 13 projects (`39e347a9`); real-device/browser permission and installed-PWA runs remain. |
| P2-14 | **Partial** | Privacy-safe, allowlisted telemetry endpoint and browser fire-and-forget client now cover report start/steps/completion/offline queue, GPS and media failures, notification inbox failures, reopen actions, language selection, reduced-motion preference, and coarse citizen-shell load buckets (`d5eea66b`, `c1a0b2a6`, current citizen layout/settings); deeper journey-performance coverage remains. |
| P2-12 | **Done** | Public landing now leads with resident report/track/transparency actions and moves staff portals into a separate entry point (`71796d7b`). |
| P2-13 | **Done** | Emergency 112 guidance appears before category selection and on the public landing; unsupported/non-emergency scope is explicit (`71796d7b`). |
| P2-11 | **Done** | Public stats exclude drafts/rejected/merged duplicates, expose generated-at/cache metadata and definitions, and both landing/public overview surfaces render freshness and denominator guidance (`48b1bd82`, current public clients). |

### Backend Performance And Correctness

| ID | Status | Notes / Evidence |
|----|--------|------------------|
| BE-09 | **Done** | List queries eager-load `department` and `media_count`; lean `ReportListResource`/`AdminReportListResource`/`DepartmentReportListResource`; `ReportListQueryCountTest` guards N+1 regressions. |
| BE-01..BE-02 | **Done** | Refresh rotation uses selector-indexed lookup and row locks; submission idempotency persists route/method-scoped reservations and stable client keys (`d847f37b`, `2cc5086a`, `5160ee85`). |
| BE-03 | **Done** | Annual tracking-number allocation uses a locked sequence table (`d847f37b`). |
| BE-04 | **Partial** | Workflow application now locks the report row and rejects stale source states with a conflict (current \`WorkflowEngine\`); assignment/version characterization and optimistic versioning remain. |
| BE-05 | **Partial** | Department-scoped proof authorization and role-separated media are implemented; assignment-owned proof/task access logs and complete cross-agency policy tests remain. |
| BE-06 | **Done** | AI orchestration persists the canonical primary label onto the report in the same transaction as AI results/labels, with unique retry constraints and pipeline coverage (\`c69087fd\`). |
| BE-07 | **Partial** | Evidence upload is validated and scanned before persistence; direct multipart/object-store streaming and presigned upload flow remain. |
| BE-08 | **Done** | Media URLs are centralized through \`MediaUrl\`; S3/MinIO use native presigned URLs while local disks use signed application routes, with remote delivery support (\`a10e9731\`). |
| BE-10 | **Partial** | Staff, department, admin, and citizen report searches now support opt-in cursor pagination with stable tie-breakers, date/category/area filters, prefix tracking search, MySQL FULLTEXT fallback, and composite indexes (\`6b523f7f\`, \`ffa2a7f8\`, current citizen search); production-shaped \`EXPLAIN ANALYZE\` validation remains. |
| BE-11 | **Done** | Indexed SLA due-at selection, bounded bootstrap, idempotent breach rows, and downstream notification listener are implemented (\`d847f37b\`). |
| BE-12 | **Done** | Notification listeners are registered only by `NotificationsServiceProvider`; duplicate registrations were removed from `AppServiceProvider`. |
| BE-13 | **Partial** | Integration URL validation rejects unsafe schemes, credentials, ports, and private/link-local/metadata addresses before probing (\`97de1e6f\`); asynchronous restricted-egress execution and full probe audit remain. |
| BE-14 | **Partial** | Retention purge now requires explicit `--approve`, supports dry-run/chunked deletion, skips append-only audit rows, removes orphaned media bytes, and honors active legal holds via `retention_holds` (`0d8e49c0`, `e3fd62d4`). Hold-management API, custody export, and production restore/retention drills remain. |
| BE-15 | **Not started** | Scheduled aggregate tables and privacy suppression are still open. |
| BE-16 | **Done** | Worker and scheduler heartbeats now gate readiness, with queue-specific freshness and dependency checks; focused heartbeat/health tests pass (`6e7f13f3`). |
| BE-17 | **Partial** | Request IDs now propagate into queue payloads, worker log context, and outbound AI/integration calls with regression coverage (`c20cbfa9`, `1cb35649`); the correlation/health response procedure is documented (`84472e15`), while full metrics/tracing dashboards and alert routing remain. |
| BE-18 | **Done** | Composer/npm audit gates, dependency exception expiry validation, and patched vulnerable Composer/npm packages are enforced in CI (`027983f0`). |
| BE-19 | **Partial** | Production source maps are disabled by default with explicit debug opt-in and a CI artifact gate (`0c3f8e90`); deployed trusted-proxy/header smoke verification remains operational. |

### Maintainability

| ID | Status | Notes / Evidence |
|----|--------|------------------|
| MAINT-01 | **Done** | Shared UI primitives extracted to `frontend/src/shared/ui/` with ownership test (`worktree/ui-extraction`, `cf50db96`). |
| MAINT-02 | **Done** | Centralized design tokens in `shared/ui/tokens.css`; `TokenMigration` / `DesignTokenUsage` tests. |
| MAINT-05 | **Done** | Citizen, operations, moderator, public, and admin clients use `frontend/src/shared/api/client.ts`; `auth/api.ts` is now a compatibility facade over that transport. Shared refresh/retry behavior has regression coverage. |
| MAINT-03, MAINT-04, MAINT-06..MAINT-12 | Not started | Controller boundary work exists only as incremental refactors; CI/static-quality and test-journey target work remains. |

### Recommended Next Step

The non-OTP production-safety work is now implemented in reviewable commits. P0-01 remains explicitly deferred (mock OTP unchanged). Before any production release, run the full backend suite in isolated CI MySQL, complete legal review for P0-13, provision cPanel Redis/ClamAV prerequisites, and resolve the remaining Partial/Not-started P1/P2/BE/maintainability items.
