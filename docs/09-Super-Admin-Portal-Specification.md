# 09 - Super Admin Portal Specification

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
* 08 Operations Portal Specification

---

# 1. Purpose

The Super Admin Portal provides complete platform administration capabilities.

Unlike the Department Portal, the Super Admin Portal is responsible for configuring the platform itself rather than operating reports.

No business logic shall be hardcoded into the application. Every configurable aspect of the platform shall be manageable through this portal.

The Super Admin Portal shall serve as the control plane for all deployments.

---

# 2. Objectives

The portal shall allow administrators to

* Configure the platform
* Manage organizations
* Manage departments
* Configure report types
* Configure workflows
* Configure routing rules
* Configure AI
* Configure integrations
* Manage users
* Configure notifications
* Configure security policies
* Configure feature flags
* Monitor platform health

---

# 3. Supported Roles

```text
Super Administrator

Platform Administrator

Security Administrator

Read Only Auditor
```

Every action shall require RBAC authorization.

---

# 4. Main Navigation

```text
Dashboard

Organizations

Departments

Users

Roles

Permissions

Report Types

Categories

Workflow Builder

Routing Rules

AI Providers

Prompt Library

Integrations

Storage

Notifications

Security

Feature Flags

Audit Logs

Analytics

Platform Health

Settings

Profile
```

---

# 5. Dashboard

Widgets

Platform Status

Total Reports

Reports Today

Open Reports

Closed Reports

AI Accuracy

Queue Status

Storage Usage

API Requests

Failed Jobs

Connected Departments

Connected AI Providers

Connected Integrations

Latest Security Alerts

Charts

Reports per Day

Reports per Category

Department Performance

API Usage

Storage Growth

AI Cost

---

# 6. Organization Management

Future multi-tenant support.

Each organization may have

Name

Logo

Address

Contact

Timezone

Language

Branding

Storage Quota

Subscription Plan

Status

Organization isolation shall be supported.

---

# 7. Department Management

Create

Update

Deactivate

Delete

Department properties

Name

Code

Parent Department

Jurisdiction

Office Address

Email

Phone

Working Hours

Holiday Calendar

Default Workflow

Default SLA

Escalation Matrix

---

# 8. User Management

Create

Update

Disable

Enable

Reset Password

Force Logout

Assign Departments

Assign Roles

Assign Permissions

View Login History

View Security Events

Lock Account

Unlock Account

Search Filters

Department

Role

Status

Last Login

Location

---

# 9. Roles & Permissions

Role Builder

Create custom roles.

Permission Categories

Reports

Users

Departments

Analytics

Settings

AI

Workflow

Notifications

Security

Audit

Integrations

Permissions shall be granular.

Example

```text
reports.view

reports.assign

reports.close

users.create

workflow.edit

settings.update

ai.configure
```

---

# 10. Report Type Management

Administrators define

Name

Description

Icon

Colour

Priority

Required Evidence

Minimum Photos

Maximum Photos

Video Requirement

Anonymous Allowed

AI Prompt

Default Department

Workflow

SLA

Validation Rules

Active

No source code changes shall be required.

---

# 11. Workflow Builder

The platform shall provide a configurable workflow engine.

Workflow consists of

States

Transitions

Roles

Conditions

Notifications

Escalations

Validation Rules

SLA Timers

Future

Visual Drag-and-Drop Workflow Designer

---

# 12. Routing Rules

Routing Rules determine where reports are sent.

Conditions

Category

Ward

Zone

District

State

Severity

Keywords

AI Labels

Time

Priority

Destination

Department

Officer

Queue

External API

Rules evaluated in priority order.

---

# 13. AI Provider Management

Administrators configure

Provider Name

API Endpoint

Authentication

Model

Temperature

Timeout

Retries

Rate Limits

Fallback Provider

Health Check

Supported Providers

Qwen VL

Blaxel

Modal

OpenAI Compatible

Future

Ollama

Gemma

---

# 14. Prompt Library

Prompts shall never be stored in code.

Each prompt stores

Name

Version

Purpose

Provider

Prompt Text

Expected JSON Schema

Created By

Approved By

Status

Rollback shall be supported.

---

# 15. Integration Management

Supported Connectors

Traffic API

Municipality API

Storage

SMS

Email

Push

Webhook

REST

OAuth

Each connector stores

Endpoint

Authentication

Retry Policy

Timeout

Health Status

Logs

---

# 16. Notification Management

Notification Channels

Push

Email

SMS

Webhook

Templates

Variables

Languages

Retry Policy

Scheduling

---

# 17. Storage Management

Supported Storage

Local

MinIO

AWS S3

Azure Blob

Google Cloud Storage

Configuration

Bucket

Region

Credentials

Encryption

Quota

Usage

Retention

---

# 18. Feature Flags

Every major feature shall be toggleable.

Examples

Anonymous Reporting

AI Enabled

OCR Enabled

Video Mandatory

Moderator Required

Public Dashboard

Offline Mode

Push Notifications

Fraud Detection

Duplicate Detection

Changes require no deployment.

---

# 19. Security Policies

Configure

Password Policy

OTP Expiry

JWT Lifetime

Session Timeout

Allowed Domains

Allowed IPs

Blocked Countries

Rate Limits

Maximum Upload Size

Maximum Video Length

Maximum Photos

Security policies are database driven.

---

# 20. Audit Logs

Search by

User

Entity

Action

Date

IP

Browser

Organization

Export

CSV

Excel

PDF

Audit records are immutable.

---

# 21. Platform Analytics

Displays

Users

Reports

Departments

AI Usage

API Usage

Storage

Notifications

Queue Performance

Fraud Statistics

Moderator Statistics

Resolution Times

---

# 22. Platform Health

Displays

API

Database

Redis

Queues

Storage

AI Providers

Email

Push

Scheduler

Integrations

Each component

Status

Latency

Error Count

Last Successful Execution

---

# 23. Scheduler Dashboard

Displays scheduled jobs.

Examples

Queue Cleanup

Storage Cleanup

Notification Retry

AI Retry

Health Checks

Statistics Aggregation

Supports

Pause

Resume

Run Now

---

# 24. API Management

View

API Keys

OAuth Clients

Webhook Tokens

JWT Secrets

Rate Limits

API Usage

Revoke Keys

Rotate Keys

---

# 25. Data Retention

Configure retention for

Images

Videos

Audit Logs

Notifications

AI Logs

Security Events

Deleted Users

Archived Reports

---

# 26. Backup Management

Displays

Database Backups

Storage Backups

Configuration Backups

Restore Points

Last Successful Backup

Future

Restore from UI

---

# 27. Global Search

Search

Reports

Users

Departments

Organizations

Integrations

Audit Logs

Settings

Tracking Number

---

# 28. Import & Export

Import

Departments

Users

Categories

Workflows

Routing Rules

Export

CSV

Excel

JSON

Configuration Package

---

# 29. System Configuration

Application Name

Branding

Logo

Theme

Primary Colour

Support Email

Help URL

Privacy Policy

Terms

Version Information

---

# 30. Deployment Configuration

Store

Environment Variables

Provider Settings

External URLs

Storage Settings

Queue Settings

Email Settings

SMS Settings

No secrets displayed after creation.

---

# 31. Monitoring

Metrics

CPU

Memory

Disk

Storage

Queue Length

Response Time

AI Latency

API Latency

Database Connections

Error Rate

---

# 32. Responsive Design

Desktop

Primary

Tablet

Supported

Mobile

Read Only

---

# 33. Folder Structure

```text
src/

pages/

Dashboard/

Organizations/

Departments/

Users/

Roles/

Permissions/

Workflow/

Routing/

AI/

Prompts/

Integrations/

Notifications/

Security/

Audit/

Analytics/

Health/

Settings/

components/

hooks/

services/

api/

utils/

types/
```

---

# 34. Definition of Done

The Super Admin Portal shall be considered complete only when

* Organization management is operational.
* User, role, and permission management are complete.
* Workflow builder is configuration-driven.
* Routing rules are editable.
* Report types are fully configurable.
* AI providers and prompts are manageable.
* Integrations are configurable.
* Feature flags are database-driven.
* Security policies are configurable.
* Audit logs are immutable and searchable.
* Platform health dashboard is operational.
* Scheduler monitoring is implemented.
* Backup and retention settings are configurable.
* Analytics dashboards are functional.
* Role-based authorization is enforced for every action.
* Unit, integration, and end-to-end tests pass.
* No configuration change requires application code modification.
