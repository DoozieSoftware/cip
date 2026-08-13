# CIP MoM Product Decisions

This file records the product decisions from the latest CIP MoM and maps them
to the implementation language used by the platform. Use these terms in
citizen, moderator, and department-officer UI.

## 1. Priority criteria

Priority is an internal routing and response-target signal. It should not be
shown to citizens as a judgement on their report. Staff may see it only where it
helps order work.

| Priority | Response target | Criteria |
| --- | ---: | --- |
| Emergency | 1 hour | Immediate life-safety risk, live hazard, or issue that must be handled by emergency/on-call channels. |
| Critical | 4 hours | Severe public-safety, access, flooding, electrical, or traffic obstruction risk requiring same-day action. |
| High | 24 hours | Clear civic issue causing significant disruption, repeated public impact, or likely escalation if not handled quickly. |
| Medium | 48 hours default unless an issue type overrides it | Normal actionable civic issue with clear evidence and no immediate safety risk. |
| Low | 7 days | Minor, informational, cosmetic, duplicate-prone, or non-urgent issue that can wait for planned work. |

Configured issue types and routing rules may override the default response
target. When issue-type response time is not configured, use the department or
routing-rule response target already stored in the platform.

## 2. Plain status definitions

| Internal code | Citizen label | Staff label | Meaning |
| --- | --- | --- | --- |
| `submitted`, `ai_processing`, `pending_moderator` | Received | New report / Needs review | Report is received and waiting for AI or moderator review. |
| `assigned`, `accepted` | Assigned to department | Assigned / Accepted by officer | A department owns the report; an officer may still need to accept the assignment. |
| `in_progress`, `reopened`, `escalated` | In progress | Work in progress / Reopened / Escalated | Field work, supervisor review, or reopened work is ongoing. |
| `resolved`, `resolved_pending_verification` | Fixed — please verify | Fixed — proof submitted / Waiting for citizen confirmation | Corrective action was reported and proof was uploaded; it is waiting for AI, citizen, or moderator validation. |
| `verified`, `closed` | Completed | Citizen confirmed / Completed | The fix was accepted by citizen validation, high-confidence proof review, or moderator closure. |
| `rejected` | Could not accept | Rejected | The report cannot be acted on by the platform. |
| `merged` | Combined with another report | Merged duplicate | The report is tracked under a primary/canonical report. |

Do not expose raw status codes in UI.

## 3. Resolved versus Completed

- **Fixed / proof submitted** means the department has uploaded completion proof
  and says corrective action is done.
- **Completed** means the fix has been accepted after validation. Completion can
  happen through:
  - citizen confirmation,
  - moderator closure, or
  - automatic proof completion when AI proof review is over 80% confident and
    the location check matches.

## 4. AI-assisted proof review

Completion proof must include officer device location. The proof-review prompt is
separate from the original report-classification prompt. It compares the
citizen’s before evidence with the officer’s after proof and weighs location
first, then visual consistency, issue type, reuse signals, and perspective.

Decision rule:

- AI-backed proof review above 80% confidence, with matching GPS and status
  `match`, may complete the report automatically.
- Anything at or below 80%, missing GPS, fallback/non-AI review, mismatch, or
  `needs_review` stays for human review.
- The UI must explain the result in plain language as “Proof review”, not by
  provider name.

## 5. Terms to use

| Avoid | Use |
| --- | --- |
| SLA | Response target, due time, overdue |
| Fraud | Misrepresentation |
| Linked report / task, when describing cross-department work | Cross-agency |
| Workflow, when shown to non-admin users | Status or next step |
| Closed, when shown to citizens | Completed |

Internal APIs and database columns may keep legacy names until a safe migration
is scheduled. User-facing labels must use the plain terms above.

## 6. Controlled pilot

The platform is ready for a controlled pilot only after the responsible owner
confirms the pilot audience, date, support channel, rollback owner, and whether
production OTP is enabled or still operating in demo mode.
