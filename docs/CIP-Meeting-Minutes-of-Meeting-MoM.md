## Key Discussion Points & Decisions

1. **Priority Definition**
   - Define clear criteria for assigning priority to CIP issues.
   - Priority levels should be standardized and consistently applied across issue types.

2. **Status Definitions & Transition Rules**
   - Establish a clear definition for each status type.
   - Document permissible status transitions and the conditions required for each transition.
   - Clarify the distinction between **Resolved** and **Closed**:
     - **Resolved:** Corrective action has been completed and evidence of resolution has been submitted.
     - **Closed:** Resolution has been reviewed/validated and formally accepted.

3. **AI-Assisted Resolution Review**
   - For issues marked as resolved, the submitted resolution photographs should be validated for:
     - Geo-tag/location information.
     - Consistency with the reported issue.
     - Evidence that the corrective action addresses the original issue.
   - AI should correlate the original issue with the submitted resolution evidence and generate a resolution review.
   - If the AI review confidence is **>80%**, the issue can proceed for automated closure.
   - If confidence is **≤80%**, the issue should be routed to a **Moderator** for manual closure.
   - The resolution/review outcome should also be reflected back to the end user.

4. **Terminology Change**
   - Rename **“Fraud”** to **“Misrepresentation”** across the system and related documentation.

5. **Response Due Time / SLA**
   - Introduce a configurable response due time for each issue type.
   - Default SLA example: **48 hours** to respond to an issue.
   - SLA should be configurable at the issue-type level.

6. **Linked Report Terminology**
   - Rename **“Linked Report”** to **“Cross Agency”** to better represent the intended functionality.

7. **Controlled Pilot**
   - Confirm when **Murthy** can share the controlled pilot with his network.
   - Pilot readiness and proposed timeline to be confirmed with Murthy.

## Action Items

| # | Action | Owner | Status |
|---|---|---|---|
| 1 | Define priority levels and assignment criteria | Product / Engineering | Done |
| 2 | Define status meanings and transition rules | Product / Engineering | Done |
| 3 | Define Resolved vs Closed workflow | Product / Engineering | Done |
| 4 | Design AI-based resolution evidence validation, including geo-tag and issue-resolution correlation | Engineering | Done |
| 5 | Define >80% AI confidence auto-closure and moderator escalation workflow | Product / Engineering | Done |
| 6 | Rename Fraud to Misrepresentation | Engineering | Done |
| 7 | Implement configurable issue-type response SLA, with 48 hours as the proposed default | Engineering | Done |
| 8 | Rename Linked Report to Cross Agency | Engineering | Done |
| 9 | Confirm controlled pilot timeline with Murthy | Murthy / Team | Open |

## Implementation Update — 13 Aug 2026

- Priority criteria and response targets are documented in `docs/mom-product-decisions.md`.
- Status meanings and transition rules are documented in `docs/mom-product-decisions.md`.
- UI now uses plain status labels:
  - **Fixed / proof submitted** = department says work is done and proof has been uploaded.
  - **Completed** = proof/citizen/moderator validation has accepted the resolution.
- AI proof review uses a separate `proof_verification` prompt and requires officer-location proof.
- AI-backed proof review with matching GPS and confidence **>80%** can complete the report automatically.
- Proof review with confidence **≤80%**, missing GPS, mismatch, or fallback/non-AI result stays for human review.
- User-facing terminology is now:
  - **Misrepresentation** instead of Fraud.
  - **Cross-agency** instead of Linked Report.
  - **Response target / due time / overdue** instead of SLA.
- Medium/default response target is aligned to **48 hours**.
- Controlled pilot timeline is still pending Murthy/team confirmation.
