# 07 - Moderator Portal Specification

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Draft

**Depends On**

* 01 Product Vision
* 02 Product Requirements Document
* 03 System Architecture
* 04 Database Design
* 05 REST API Specification
* 06 Citizen PWA Specification

---

# 1. Purpose

The Moderator Portal is the operational control center of the Civic Intelligence Platform.

Its primary responsibility is to ensure that only valid, properly classified, non-fraudulent reports are forwarded to government departments.

Moderators act as the bridge between AI and government departments.

---

# 2. Objectives

The portal shall enable moderators to

* Review AI classified reports
* Correct AI mistakes
* Merge duplicate reports
* Reject fraudulent reports
* Validate evidence quality
* Assign reports
* Escalate reports
* Monitor AI performance
* Manage report lifecycle until department assignment

---

# 3. Users

Supported Roles

```text
Moderator

Senior Moderator

Moderator Supervisor

Read Only Auditor
```

Permissions are role-based.

---

# 4. Dashboard

The landing dashboard displays operational metrics.

Widgets

Today's Reports

Pending AI Queue

Duplicate Queue

Fraud Queue

Assigned Today

Rejected Today

Average Review Time

Department Distribution

AI Accuracy

System Health

Recent Alerts

---

# 5. Navigation

```text
Dashboard

↓

Review Queue

↓

Report Details

↓

Duplicate Queue

↓

Fraud Queue

↓

Assignments

↓

Analytics

↓

Notifications

↓

Profile
```

---

# 6. Review Queue

Displays reports awaiting moderator action.

Columns

Tracking Number

Submitted Time

Category

AI Prediction

Confidence

Priority

Ward

District

Evidence Count

Risk Score

Status

Filters

Category

Ward

District

Date

Confidence

Risk

Priority

Search

Tracking Number

Citizen Mobile

Area

---

# 7. AI Confidence Rules

The system automatically categorizes reports.

Confidence >95%

↓

Auto Assign

80–95%

↓

Moderator Review

<80%

↓

Manual Classification Required

Moderators may override AI decisions.

Every override is audited.

---

# 8. Report Detail Screen

Displays complete report information.

Sections

General Information

Evidence

Location

AI Analysis

Timeline

Assignments

Audit History

Security Events

Integration Status

Citizen Information (if permitted)

---

# 9. Evidence Viewer

Supports

Multiple Photos

Video Playback

Zoom

Fullscreen

Metadata

Displayed Metadata

Timestamp

GPS

Camera Device

Image Hash

Video Hash

Capture Duration

Storage Information

No download option.

---

# 10. Map View

Displays

Location

Ward

Zone

Nearby Reports

Heat Map

Duplicate Candidates

Map Providers

OpenStreetMap

MapLibre

---

# 11. AI Analysis Panel

Displays

Predicted Category

Confidence

Suggested Department

Detected Objects

Severity

Duplicate Score

Fraud Score

Quality Score

AI Summary

Prompt Version

Model Used

Processing Time

---

# 12. Moderator Actions

Approve

Reject

Reclassify

Merge

Escalate

Reassign

Flag Fraud

Request Review

Every action requires remarks.

---

# 13. Duplicate Detection

Shows

Primary Report

Possible Duplicates

Distance

Similarity

Time Difference

Image Similarity

AI Confidence

Moderator Options

Merge

Keep Separate

Ignore

---

# 14. Fraud Queue

Displays reports flagged by security systems.

Reasons

Mock GPS

Rooted Device

Repeated Spam

AI Generated Images

Metadata Tampering

Duplicate Device

VPN Abuse

Rapid Submission

Replay Attack

Moderator Actions

Approve

Reject

Escalate

Ban Recommendation

---

# 15. Manual Classification

If AI fails,

Moderator selects

Category

Department

Priority

Severity

Workflow

Remarks

These corrections improve future AI training.

---

# 16. Assignment

Moderator assigns reports to

Department

Officer (optional)

Priority

SLA

Special Instructions

Assignment generates

Notification

Audit Entry

Workflow Transition

---

# 17. Escalation

Escalation Levels

Ward

Zone

District

City

State

National

Escalation Reasons

Emergency

High Priority

Media Attention

VIP Complaint

Legal Matter

System Failure

---

# 18. Search

Supports

Tracking Number

Citizen Mobile

Category

Department

Ward

District

Status

Priority

Officer

Date Range

Risk Score

AI Confidence

---

# 19. Bulk Operations

Supported

Approve

Assign

Reject

Merge

Export

Notification

Maximum batch

100 reports

---

# 20. Analytics

Charts

Reports by Category

Reports by Ward

AI Accuracy

Review Time

Duplicate Rate

Fraud Rate

Department Load

Moderator Performance

Daily Trend

Monthly Trend

---

# 21. AI Performance Dashboard

Displays

Model Version

Average Confidence

Override Rate

Classification Accuracy

False Positives

False Negatives

Average Processing Time

Provider Availability

Useful for monitoring AI quality.

---

# 22. Notifications

Moderator receives alerts for

High Priority Reports

AI Failure

Integration Failure

Emergency Reports

Escalated Reports

Security Incidents

---

# 23. Security

Session Timeout

30 Minutes

Mandatory 2FA (Future)

IP Logging

Browser Fingerprinting

Audit Logging

Role Validation

Every action recorded.

---

# 24. Audit History

Every moderator action stores

Moderator

Timestamp

Action

Previous State

New State

Remarks

IP Address

Browser

No audit record may be edited.

---

# 25. Export

Supported Formats

CSV

Excel

PDF

Filters respected.

Exports are permission controlled.

---

# 26. Performance Targets

Dashboard

<2 seconds

Queue Search

<500ms

Report Open

<2 seconds

Evidence Load

<3 seconds

Bulk Assignment

<5 seconds

---

# 27. Responsive Design

Desktop

Primary

Tablet

Supported

Mobile

Read Only

---

# 28. UI Components

Dashboard Cards

Data Table

Filters

Search Bar

Evidence Carousel

Video Player

Timeline

Status Badge

AI Confidence Badge

Fraud Badge

Map

Assignment Dialog

Confirmation Dialog

Toast Notifications

Charts

---

# 29. Folder Structure

```text
src/

pages/

Dashboard/

ReviewQueue/

ReportDetails/

FraudQueue/

DuplicateQueue/

Analytics/

Assignments/

components/

hooks/

services/

api/

types/

utils/
```

---

# 30. API Consumption

Consumes

Authentication APIs

Report APIs

AI APIs

Moderator APIs

Department APIs

Notification APIs

Analytics APIs

No direct database access.

---

# 31. Keyboard Shortcuts

Recommended

A

Approve

R

Reject

M

Merge

E

Escalate

N

Next Report

P

Previous Report

F

Focus Search

---

# 32. Accessibility

WCAG AA

Keyboard Navigation

Screen Reader Support

Color Independent Status Indicators

---

# 33. Future Enhancements

AI-assisted moderation

Voice notes

Live collaboration

Multi-moderator review

Video annotation

Frame-by-frame inspection

Auto fraud investigation

Machine learning feedback loop

---

# 34. Definition of Done

The Moderator Portal shall be considered complete only when:

* Dashboard is implemented.
* Review queue supports filtering, searching, and pagination.
* AI analysis panel is functional.
* Evidence viewer supports secure preview.
* Duplicate review workflow is operational.
* Fraud queue is operational.
* Manual classification is supported.
* Assignment workflow is complete.
* Audit logging is enforced.
* Role-based authorization is implemented.
* Analytics dashboards are functional.
* Export functionality is implemented.
* Accessibility requirements are met.
* Unit, integration, and end-to-end tests pass.
* No moderator action bypasses workflow validation or audit logging.
