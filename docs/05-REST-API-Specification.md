# 05 - REST API Specification

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Draft

**Depends On**

* 01 Product Vision
* 02 Product Requirements Document
* 03 System Architecture
* 04 Database Design

---

# 1. Purpose

This document defines every REST API exposed by the Civic Intelligence Platform.

The API shall serve as the single integration interface for:

* Flutter Mobile App
* Moderator Portal
* Department Portal
* Super Admin Portal
* Public Portal
* External Government Systems

This specification shall be converted into an OpenAPI 3.1 document during implementation.

---

# 2. API Standards

## Base URL

```
/api/v1
```

Future versions

```
/api/v2
```

---

## Content Type

```
application/json
```

Multipart

```
multipart/form-data
```

for media uploads.

---

## Authentication

Citizen

```
Bearer Token
```

Moderator

```
Bearer Token
```

Department

```
Bearer Token
```

Admin

```
Bearer Token
```

Laravel Sanctum.

---

# 3. Standard Response Format

Success

```json
{
  "success": true,
  "message": "Report created successfully",
  "data": {},
  "meta": {}
}
```

Failure

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {},
  "trace_id": "uuid"
}
```

---

# 4. HTTP Status Codes

| Code | Meaning           |
| ---- | ----------------- |
| 200  | OK                |
| 201  | Created           |
| 202  | Accepted          |
| 204  | No Content        |
| 400  | Bad Request       |
| 401  | Unauthorized      |
| 403  | Forbidden         |
| 404  | Not Found         |
| 409  | Conflict          |
| 422  | Validation Failed |
| 429  | Rate Limited      |
| 500  | Internal Error    |

---

# 5. Authentication APIs

## Send OTP

```
POST /auth/send-otp
```

Body

```json
{
  "mobile":"9876543210"
}
```

Response

```json
{
 "otp_sent":true
}
```

---

## Verify OTP

```
POST /auth/verify-otp
```

Response

```json
{
 "token":"",
 "user":{}
}
```

---

## Logout

```
POST /auth/logout
```

---

## Refresh Token

```
POST /auth/refresh
```

---

## Current User

```
GET /auth/me
```

---

# 6. Citizen APIs

## Dashboard

```
GET /citizen/dashboard
```

Returns

* Report count
* Pending
* Closed
* Notifications

---

## My Reports

```
GET /citizen/reports
```

Supports

```
status

date

category
```

Pagination mandatory.

---

## Report Details

```
GET /citizen/reports/{id}
```

Returns

* Timeline
* Evidence
* Status

---

## Submit Report

```
POST /reports
```

Multipart request

Fields

```
title

description

category

latitude

longitude

accuracy

anonymous

photos[]

video
```

Response

```
tracking_number
```

---

## Upload Photo

```
POST /reports/{id}/photos
```

---

## Upload Video

```
POST /reports/{id}/video
```

One video only.

---

## Submit Report

```
POST /reports/{id}/submit
```

Changes state

Draft

↓

Submitted

---

# 7. Report APIs

## Search

```
GET /reports
```

Filters

```
status

department

ward

district

priority

date

category
```

Role restricted.

---

## Details

```
GET /reports/{id}
```

---

## Timeline

```
GET /reports/{id}/timeline
```

---

## Media

```
GET /reports/{id}/media
```

---

## AI Results

```
GET /reports/{id}/ai
```

Moderator+

The AI result includes the visual category, calibrated confidence, quality,
duplicate and fraud scores, plus evidence consistency fields:

```json
{
  "claim_matches_evidence": false,
  "consistency_score": 0,
  "mismatch_reason": "The image shows illegal dumping, not a pothole.",
  "synthetic_score": 0.0
}
```

---

## Assignments

```
GET /reports/{id}/assignments
```

---

# 8. Moderator APIs

## Queue

```
GET /moderator/queue
```

Returns

Pending AI

---

## Duplicate Queue

```
GET /moderator/duplicates
```

---

## Fraud Queue

```
GET /moderator/fraud
```

---

## Review Report

```
POST /moderator/review
```

Body

```json
{
"report_id":"",
"decision":"approve",
"category":"",
"department":""
}
```

---

## Merge Reports

```
POST /moderator/merge
```

---

## Reject

```
POST /moderator/reject
```

---

## Escalate

```
POST /moderator/escalate
```

---

# 9. Department APIs

## Dashboard

```
GET /department/dashboard
```

---

## Assigned Reports

```
GET /department/reports
```

---

## Accept

```
POST /department/report/{id}/accept
```

---

## Start Work

```
POST /department/report/{id}/start
```

---

## Update Progress

```
POST /department/report/{id}/progress
```

---

## Resolve

```
POST /department/report/{id}/resolve
```

---

## Close

```
POST /department/report/{id}/close
```

---

## Internal Notes

```
POST /department/report/{id}/note
```

Private.

---

# 10. Admin APIs

## Users

```
GET /admin/users
```

```
POST /admin/users
```

```
PUT /admin/users/{id}
```

```
DELETE /admin/users/{id}
```

---

## Departments

CRUD

```
/admin/departments
```

---

## Categories

CRUD

```
/admin/report-types
```

---

## Workflow

CRUD

```
/admin/workflows
```

---

## AI Providers

CRUD

```
/admin/ai/providers
```

---

## Routing Rules

CRUD

```
/admin/routing
```

---

## Settings

CRUD

```
/admin/settings
```

---

# 11. AI APIs

Internal only.

## Submit

```
POST /internal/ai/process
```

Queue only.

---

## Status

```
GET /internal/ai/job/{id}
```

---

## Result

```
GET /internal/ai/result/{id}
```

---

# 12. Notification APIs

Citizen

```
GET /notifications
```

Mark Read

```
POST /notifications/read
```

Delete

Not Supported.

---

# 13. Public APIs

## Statistics

```
GET /public/statistics
```

---

## Heatmap

```
GET /public/heatmap
```

---

## Departments

```
GET /public/departments
```

---

## Report Counts

```
GET /public/reports/count
```

---

# 14. File Upload APIs

Maximum

Photos

10

Video

1

Formats

JPEG

PNG

MP4

MOV

Validation

GPS

Timestamp

Hash

Metadata

---

# 15. Search Parameters

Supported

```
page

per_page

sort

order

status

department

ward

district

priority

date_from

date_to

search
```

---

# 16. Pagination

Standard

```json
{
"data":[],
"meta":{
"page":1,
"per_page":20,
"total":250
}
}
```

---

# 17. Error Codes

Examples

```
REPORT_NOT_FOUND

INVALID_GPS

VIDEO_REQUIRED

PHOTO_REQUIRED

AI_TIMEOUT

UNAUTHORIZED

ACCESS_DENIED

RATE_LIMITED

DUPLICATE_REPORT

INVALID_STATUS
```

---

# 18. Rate Limits

Citizen

```
60 requests/minute
```

Uploads

```
20/hour
```

Anonymous

```
10/day
```

Moderator

```
300/minute
```

Department

```
300/minute
```

Admin

Unlimited.

---

# 19. API Security

All APIs require

HTTPS

JWT

CSRF (Web)

Authorization

Rate Limiting

Input Validation

Device Validation

Audit Logging

---

# 20. Idempotency

Required for

Report Submission

Payments (future)

External APIs

Clients shall send

```
Idempotency-Key
```

---

# 21. Versioning

```
/api/v1
```

Breaking changes require

```
/api/v2
```

No breaking changes inside a version.

---

# 22. Audit

Every write operation shall create audit entries.

Examples

Create Report

Update Status

AI Result

Assignment

Configuration Change

Delete User

Ban User

---

# 23. API Documentation

Every endpoint shall include

* Summary
* Description
* Authentication
* Permissions
* Request Schema
* Response Schema
* Error Codes
* Example Requests
* Example Responses

Generated using OpenAPI 3.1 and Swagger UI.

---

# 24. Endpoint Summary

## Authentication

```
POST   /auth/send-otp
POST   /auth/verify-otp
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me
```

## Citizen

```
GET    /citizen/dashboard
GET    /citizen/reports
GET    /citizen/reports/{id}
POST   /reports
POST   /reports/{id}/photos
POST   /reports/{id}/video
POST   /reports/{id}/submit
```

## Reports

```
GET    /reports
GET    /reports/{id}
GET    /reports/{id}/timeline
GET    /reports/{id}/media
GET    /reports/{id}/ai
```

## Moderator

```
GET    /moderator/queue
GET    /moderator/duplicates
GET    /moderator/fraud
POST   /moderator/review
POST   /moderator/merge
POST   /moderator/reject
POST   /moderator/escalate
```

## Department

```
GET    /department/dashboard
GET    /department/reports
POST   /department/report/{id}/accept
POST   /department/report/{id}/start
POST   /department/report/{id}/progress
POST   /department/report/{id}/resolve
POST   /department/report/{id}/close
POST   /department/report/{id}/note
```

## Administration

```
CRUD /admin/users
CRUD /admin/departments
CRUD /admin/report-types
CRUD /admin/workflows
CRUD /admin/settings
CRUD /admin/routing
CRUD /admin/ai/providers
```

## Public

```
GET /public/statistics
GET /public/heatmap
GET /public/departments
GET /public/reports/count
```

## Internal

```
POST /internal/ai/process
GET  /internal/ai/job/{id}
GET  /internal/ai/result/{id}
```

---

# 25. Definition of API Completion

The API implementation shall be considered complete only when:

* Every endpoint is implemented.
* OpenAPI documentation is generated.
* Authentication is enforced.
* Authorization policies are applied.
* Validation rules are implemented.
* Rate limiting is configured.
* Audit logging is operational.
* Feature tests cover all endpoints.
* API responses follow the standard response envelope.
* No endpoint bypasses the service layer or business rules.
