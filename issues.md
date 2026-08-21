# Client Issue Register

Source: latest client change list dated 20–21 August 2026.

`AJ` refers to the project owner/developer. Statuses below describe the current
state in this repository; external business tasks are kept visible but are not
marked complete without evidence outside the codebase.

## Meeting note

- 20 August 2026: Meeting with Dr. Linen, Narayanan, Akshara Dinkar, AJ, and Sandhya.

This is a meeting record, not an application issue.

## Issues

| # | Client request | Status | Notes |
|---:|---|---|---|
| 1 | Change “Report” to “Complaint” across all pages. | Open | Requires a product-wide wording audit. |
| 2 | Change Active to Pending, Closed to Resolved, and add Pending for Submission. | Open | Requires one consistent status mapping across Citizen, Moderator, Authorities, and MIS. |
| 3 | Show pie charts and graphs with percentage values as numbers. | Open | Requires an analytics UI audit and verification of each chart. |
| 4 | Fix the moderator approval error. | Completed | Fixed, tested, merged to `main`, and deployed on 21 August 2026. |
| 5 | Change “Report” to “Complaints” under Citizen, Moderator, Authorities, and elsewhere, except MIS. | Open | Overlaps item 1 and clarifies the scope outside MIS. |
| 6 | Add provisions for collecting clothes and metal waste, and discarding electronic waste. | Open | Requires final category names, departments, routing, and evidence requirements. |
| 7 | Push data to the respective department Facebook walls if the government does not use the software. | Blocked | Requires Facebook app/page permissions, consent, privacy rules, and posting policy. |
| 8 | Explore CIP for maintenance and other activities in companies and factories. | Discovery | Needs a separate use-case and workflow review before implementation. |
| 9 | Explore adding “Survey Your School” (School Thik Karo Abhiyan). | Discovery | Needs survey owner, question model, audience, privacy, and reporting requirements. |

## Current implementation note

The moderator approval failure was caused by the previous production/runtime
issues around request throttling, service-worker registration, VAPID key loading,
and queue workers. The repaired flow passed CI and production deployment. A
fresh production end-to-end push test is still needed before calling browser
notifications fully verified in production.
