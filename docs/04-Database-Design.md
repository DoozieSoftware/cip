# 04 - Database Design & Domain Model

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Draft

**Depends On**

* 01 Product Vision
* 02 Product Requirements Document
* 03 System Architecture

---

# 1. Purpose

This document defines the logical and physical database architecture for the Civic Intelligence Platform.

It is the single source of truth for:

* Laravel Migrations
* Eloquent Models
* Foreign Keys
* Indexes
* Constraints
* API Contracts
* GIS Design
* Audit Strategy

All database changes must conform to this specification.

---

# 2. Database Technology

| Component      | Technology       |
| -------------- | ---------------- |
| Database       | PostgreSQL 17    |
| GIS            | PostGIS          |
| Cache          | Redis            |
| Queue          | Redis            |
| Object Storage | MinIO / S3       |
| ORM            | Laravel Eloquent |

---

# 3. Database Design Principles

* UUID primary keys
* Soft deletes where applicable
* Immutable audit history
* UTC timestamps
* Referential integrity enforced
* No JSON blobs for structured data
* Configuration-driven master tables
* GIS enabled for location queries

---

# 4. Domain Model

The platform revolves around one primary aggregate.

```text
Report
│
├── Reporter
├── Category
├── Department
├── Workflow
├── Location
├── Media
├── AI Analysis
├── Assignment
├── Status History
├── Notifications
├── External Integrations
└── Audit
```

Everything else supports the lifecycle of a Report.

---

# 5. Entity Overview

## Core Tables

```
users
roles
permissions

reports
report_types
report_statuses
report_priorities

departments
department_users

locations
wards
zones
districts
states
countries

media
media_hashes

ai_jobs
ai_results
ai_labels

workflow_definitions
workflow_states
workflow_transitions

report_assignments

notifications
notification_logs

integration_connectors
integration_requests

audit_logs

security_events

settings
```

---

# 6. User Domain

## users

Purpose

Stores all authenticated users.

Fields

```
id UUID PK

name

mobile

email

password

otp_verified

anonymous_enabled

status

last_login

created_at

updated_at

deleted_at
```

Indexes

```
mobile UNIQUE

email UNIQUE

status
```

---

## roles

Examples

Citizen

Moderator

Department Officer

Department Admin

Super Admin

System

---

## permissions

Spatie Permission compatible.

---

## role_user

Many-to-many mapping.

---

# 7. Report Domain

## reports

The most important table.

```
id UUID

tracking_number

citizen_id

report_type_id

department_id

current_status_id

priority_id

workflow_id

location_id

assigned_to

title

description

ai_confidence

fraud_score

duplicate_score

is_anonymous

is_verified

submitted_at

closed_at

created_at

updated_at

deleted_at
```

Indexes

```
tracking_number UNIQUE

department_id

workflow_id

status_id

citizen_id

submitted_at

priority_id
```

---

## report_types

Examples

Illegal Parking

Garbage

Pothole

Streetlight

Water Leakage

Road Damage

Illegal Dumping

Encroachment

Dead Animal

Open Drain

Fields

```
id

name

code

department_default

requires_video

requires_photo

minimum_photos

maximum_photos

workflow_definition_id

active
```

Categories shall NEVER be hardcoded.

---

## report_statuses

Examples

Draft

Submitted

AI Processing

Pending Moderator

Assigned

Accepted

In Progress

Resolved

Verified

Closed

Rejected

---

## report_priorities

Low

Medium

High

Critical

Emergency

---

# 8. Location Domain

## locations

Stores precise GIS location.

```
id

latitude

longitude

altitude

accuracy

heading

speed

gps_provider

captured_at

geom (PostGIS Point)

created_at
```

Spatial Index

```
GIST(geom)
```

---

## countries

Master

---

## states

Master

---

## districts

Master

---

## cities

Master

---

## zones

Master

---

## wards

Master

Fields

```
ward_number

municipality

district

boundary_polygon
```

Polygon stored in PostGIS.

---

# 9. Media Domain

## media

```
id

report_id

type

storage_disk

storage_path

mime

size

duration

checksum

captured_at

uploaded_at
```

Type

PHOTO

VIDEO

DOCUMENT

---

## media_hashes

Stores

SHA256

MD5

Perceptual Hash

Used for duplicate detection.

---

# 10. AI Domain

## ai_jobs

Tracks inference requests.

```
id

report_id

provider

model

status

requested_at

completed_at

processing_time
```

---

## ai_results

Stores AI output.

```
id

job_id

predicted_type

confidence

recommended_department

severity

quality_score

duplicate_score

fraud_score

summary

claim_matches_evidence

consistency_score

mismatch_reason

synthetic_score
```

---

## ai_labels

Stores detected objects.

Example

```
Vehicle

Garbage

Road

Pothole

Streetlight

Tree

Signal

Drain
```

---

# 11. Workflow Domain

## workflow_definitions

```
id

name

description

active
```

---

## workflow_states

Stores all states.

---

## workflow_transitions

```
from_state

to_state

role

conditions
```

Configuration driven.

---

# 12. Assignment Domain

## report_assignments

Tracks ownership.

```
report

department

officer

assigned_by

assigned_at

accepted_at

completed_at
```

Supports reassignment.

---

# 13. Notification Domain

## notifications

Stores pending notifications.

---

## notification_logs

Immutable delivery history.

Supports

Push

Email

SMS

---

# 14. Integration Domain

## integration_connectors

Configurable connectors.

Fields

```
name

base_url

authentication

timeout

retry_count

enabled
```

---

## integration_requests

Stores every external API request.

Fields

```
request

response

status

latency

retry_count
```

---

# 15. Audit Domain

## audit_logs

Immutable.

Fields

```
user

entity

entity_id

action

before

after

ip

device

timestamp
```

No updates permitted.

Append-only.

---

# 16. Security Domain

## security_events

Stores

Root Detection

Mock GPS

Replay

VPN

Rate Limit

Ban

Appeal

Fields

```
user

event

severity

action

resolved
```

---

# 17. Analytics Domain

## report_daily_statistics

Materialized statistics.

---

## department_statistics

Daily SLA metrics.

---

## ai_statistics

AI performance.

---

# 18. Configuration Domain

## settings

Global key/value settings.

---

## app_configs

Feature flags.

Examples

```
Anonymous Reporting

Video Mandatory

AI Enabled

Department Routing

Mock GPS Policy
```

---

# 19. Relationships

```
User

│

├── Reports

├── Notifications

├── Audit Logs

└── Security Events



Report

│

├── Media

├── AI Results

├── Assignments

├── Workflow

├── Status History

├── Notifications

├── Location

└── Integrations



Department

│

├── Officers

├── Reports

└── Statistics
```

---

# 20. GIS Strategy

Every report stores

Latitude

Longitude

PostGIS Point

Nearest Ward

Nearest Zone

Nearest Municipality

Nearest District

Nearest State

Area lookup occurs during submission.

Coordinates remain immutable.

---

# 21. Soft Delete Policy

Allowed

Users

Departments

Categories

Settings

Forbidden

Reports

Audit Logs

Notifications

Assignments

AI Results

Security Events

Evidence is permanent.

---

# 22. Retention Policy

Images

10 years

Videos

10 years

Audit Logs

Permanent

Notifications

2 years

Security Events

10 years

API Logs

5 years

---

# 23. Naming Convention

Tables

snake_case plural

Columns

snake_case

Primary Keys

id

Foreign Keys

entity_id

Indexes

idx_table_column

Unique

uk_table_column

---

# 24. Required Indexes

Reports

```
status

department

workflow

submitted_at

tracking_number

priority
```

Media

```
report_id
```

AI

```
report_id

confidence
```

Assignments

```
department

officer
```

Spatial

```
locations.geom
wards.boundary_polygon
```

---

# 25. Constraints

* No orphan media.
* No orphan AI results.
* Every report must have one location.
* Every report must have at least one photograph.
* Every report must have one video.
* Every report must have a workflow.
* Every report must have a status.
* Every report must have an audit trail.
* Foreign keys are mandatory.
* Cascading deletes are prohibited for evidence.

---

# 26. Partition Strategy

Future support for PostgreSQL partitioning.

Partition candidates

Reports

Audit Logs

Notifications

Security Events

Integration Requests

Partition key

```
submitted_at
```

Monthly partitions.

---

# 27. Estimated Database Size

| Reports       | 10 Million  |
| ------------- | ----------- |
| Images        | 80 Million  |
| Videos        | 10 Million  |
| Audit Logs    | 500 Million |
| AI Results    | 10 Million  |
| Notifications | 100 Million |

Database stores metadata only.

Binary files reside in object storage.

---

# 28. Laravel Model Structure

Every entity shall contain

* Model
* Factory
* Migration
* Seeder
* Policy
* Observer
* API Resource
* Form Requests
* Repository (where required)
* Service
* Feature Tests
* Unit Tests

---

# 29. Future Extensions

Reserved domains

* Vehicle Registry
* Citizen Reputation
* Rewards
* ML Feedback
* IoT Devices
* Drone Reports
* CCTV Reports
* WhatsApp Reporting
* Voice Reporting
* Satellite Imagery
* Predictive Maintenance

No breaking schema changes should be required.

---

# 30. Definition of Database Completion

Database implementation shall be considered complete only when:

* All entities are implemented.
* Foreign keys are enforced.
* Spatial indexes exist.
* Seeders are available.
* Factories exist.
* Soft delete policy is implemented.
* Audit logging is operational.
* Unit tests pass.
* Integration tests pass.
* Performance indexes are validated.
* Migration rollback succeeds without data corruption.

This document is the authoritative reference for all database migrations and Eloquent models.
