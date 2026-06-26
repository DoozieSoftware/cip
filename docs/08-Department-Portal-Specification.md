# 08 - Operations Portal Specification (Department & Administration)

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
* 07 Moderator Portal Specification

---

# 1. Purpose

The Operations Portal is the primary application used by government departments and platform administrators.

Instead of maintaining separate portals, the application shall expose functionality based on the authenticated user's role and permissions.

This portal is responsible for:

* Issue Resolution
* Department Administration
* Platform Administration
* AI Configuration
* Workflow Configuration
* Reporting & Analytics
* External Integrations

---

# 2. Supported Roles

```text
Super Administrator

Platform Administrator

Moderator Supervisor

Department Administrator

Department Officer

Read Only Auditor
```

Every feature shall be protected through Role Based Access Control (RBAC).

---

# 3. Application Modules

```text
Dashboard

Reports

Assignments

Departments

Users

Report Types

Workflow

Routing Rules

AI Providers

Integrations

Notifications

Analytics

Security

Audit Logs

Settings
```

---

# 4. Dashboard

Widgets

* Open Reports
* Reports Due Today
* SLA Breaches
* AI Accuracy
* Pending Moderation
* Reports by Department
* Emergency Reports
* Integration Health
* Queue Health
* Active Users
* Storage Usage

Charts

* Daily Reports
* Monthly Trends
* Category Distribution
* Resolution Time
* Department Performance
* Heat Map

---

# 5. Report Management

Capabilities

View

Assign

Transfer

Update Status

Close

Reopen

Escalate

Merge

Export

Archive

---

# 6. Report Detail Screen

Displays

General Information

Citizen Information

Evidence

Location

Timeline

AI Analysis

Assignment History

Department Notes

Security Events

API History

Audit Trail

Buttons

Accept

Reject

Assign

Transfer

Resolve

Close

Escalate

---

# 7. Assignment Workflow

```text
Unassigned

↓

Assigned

↓

Accepted

↓

Work Started

↓

Pending Verification

↓

Resolved

↓

Closed
```

Assignments generate

* Notification
* Audit Record
* Workflow Event

---

# 8. Department Management

Manage

Departments

Zones

Wards

Districts

Officers

Managers

SLAs

Office Locations

Working Hours

Holiday Calendar

---

# 9. User Management

Create

Edit

Disable

Reset Password

Assign Roles

Assign Departments

View Login History

View Security Events

Lock Account

Unlock Account

---

# 10. Report Type Management

Administrators shall configure

Name

Description

Required Photos

Video Requirement

Workflow

Department

Priority Rules

AI Prompt

Validation Rules

Visibility

No report type shall be hardcoded.

---

# 11. Workflow Builder

Administrators can configure

States

Transitions

Permissions

Approval Rules

Notifications

Escalations

SLAs

Future graphical workflow editor supported.

---

# 12. Routing Rules

Configure routing based on

Category

Ward

Zone

District

State

Severity

Keywords

AI Labels

Example

```text
Category = Garbage

Ward = 112

↓

Department = BBMP

↓

Priority = Medium
```

---

# 13. AI Provider Management

Supported Providers

Qwen VL

Blaxel

Modal

OpenAI Compatible

Future

Ollama

Administrators configure

API Keys

Models

Timeouts

Retries

Prompt Templates

Fallback Providers

Health Status

---

# 14. External Integrations

Manage

Traffic APIs

Municipal APIs

Notification APIs

Storage Providers

Authentication Providers

Future Connectors

Each connector supports

Enable

Disable

Retry

Health Check

Logs

---

# 15. Notification Management

Templates

Push

Email

SMS

Variables

Language

Scheduling

Retry Policies

---

# 16. Analytics

Operational Analytics

Reports by Category

Reports by Area

Department Performance

Average Resolution Time

SLA Compliance

Moderator Performance

AI Accuracy

Fraud Detection

Citizen Activity

Executive Dashboards

Daily Reports

Monthly Reports

Yearly Trends

Top Problem Areas

Most Active Departments

---

# 17. GIS Dashboard

Displays

Live Reports

Heat Maps

Clustered Reports

Department Boundaries

Ward Boundaries

Zones

Filters

Category

Status

Priority

Date

Department

---

# 18. Audit Logs

Searchable

Filters

User

Role

Action

Date

Entity

IP Address

Browser

Export Supported

Audit logs are immutable.

---

# 19. Security Dashboard

Displays

Failed Logins

Locked Accounts

Mock GPS Reports

Spam Detection

Rate Limited Users

Suspicious Devices

Blocked Users

Security Alerts

---

# 20. Ban Management

Administrators may

Suspend User

Temporary Ban

Permanent Ban

Restore Account

Record Reason

Appeal Review

Every action audited.

---

# 21. Settings

Platform

Application Name

Logo

Themes

Languages

Time Zone

Maintenance Mode

Feature Flags

Evidence Rules

Upload Limits

Anonymous Reporting

AI Enablement

API Rate Limits

Retention Policies

---

# 22. File Management

View

Images

Videos

Documents

Storage Usage

Broken Files

Duplicate Files

Integrity Verification

No direct editing permitted.

---

# 23. Search

Global Search

Supports

Tracking Number

Citizen

Department

Officer

Category

Vehicle Number (Future)

Ward

District

Date

---

# 24. Bulk Operations

Assign

Transfer

Close

Export

Notify

Archive

Maximum

500 records

Confirmation mandatory.

---

# 25. Reports & Exports

Supported Formats

CSV

Excel

PDF

JSON

Scheduled Reports (Future)

---

# 26. Performance Targets

Dashboard

<2 seconds

Search

<500 ms

Report Open

<2 seconds

Bulk Update

<5 seconds

Export

<30 seconds

---

# 27. UI Components

Dashboard Cards

Charts

Maps

Data Tables

Advanced Filters

Timeline

Evidence Viewer

Video Player

Dialogs

Forms

Charts

Progress Indicators

Badges

---

# 28. Responsive Design

Desktop

Primary

Tablet

Supported

Mobile

Administrative actions restricted.

---

# 29. Folder Structure

```text
src/

pages/

Dashboard/

Reports/

Departments/

Users/

Workflow/

AI/

Integrations/

Analytics/

Audit/

Settings/

components/

hooks/

services/

api/

types/

utils/
```

---

# 30. Permissions Matrix

| Module       | Super Admin | Platform Admin | Dept Admin | Dept Officer | Auditor |
| ------------ | ----------- | -------------- | ---------- | ------------ | ------- |
| Reports      | CRUD        | CRUD           | CRUD       | Update       | Read    |
| Users        | CRUD        | CRUD           | Read       | No           | Read    |
| Departments  | CRUD        | CRUD           | Read       | No           | Read    |
| AI Providers | CRUD        | Read           | No         | No           | Read    |
| Workflow     | CRUD        | Read           | No         | No           | Read    |
| Settings     | CRUD        | Read           | No         | No           | Read    |
| Audit Logs   | Read        | Read           | Read       | No           | Read    |

---

# 31. Operational Monitoring

The portal shall provide health dashboards for

Database

Redis

Queue Workers

AI Providers

Storage

Email Service

Push Notification Service

External APIs

Scheduled Jobs

Each component shall expose

Status

Latency

Error Count

Last Successful Execution

---

# 32. Future Modules

Vehicle Registry

Officer Mobile App

Citizen Rewards

Drone Reporting

WhatsApp Integration

IoT Sensors

CCTV Integrations

Predictive Analytics

Digital Twin Dashboard

---

# 33. Definition of Done

The Operations Portal shall be considered complete only when

* Role-based navigation is implemented.
* Department workflows are functional.
* User and department administration is complete.
* AI provider configuration is operational.
* Workflow and routing configuration are database-driven.
* Analytics dashboards are implemented.
* GIS dashboard is functional.
* Security dashboard is operational.
* Audit logs are searchable and immutable.
* External integration management is complete.
* Settings module is fully configurable.
* Bulk operations respect authorization.
* Accessibility requirements are met.
* Unit, integration, and end-to-end tests pass.
* No administrative function bypasses authorization or audit logging.
