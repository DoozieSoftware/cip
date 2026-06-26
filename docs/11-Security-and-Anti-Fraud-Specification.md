# 11 - Security & Anti-Fraud Specification

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
* 09 Super Admin Portal Specification
* 10 AI Vision Engine Specification

---

# 1. Purpose

This document defines the complete security architecture and anti-fraud framework of the Civic Intelligence Platform.

Unlike conventional complaint applications, the platform treats every submitted report as potential evidence. Therefore, protecting the integrity, authenticity, and chain of custody of evidence is a primary system requirement.

The system shall prevent, detect, record, and respond to fraudulent behaviour while minimizing inconvenience for legitimate users.

---

# 2. Security Objectives

The platform shall

* Protect citizen data
* Protect evidence integrity
* Prevent fake submissions
* Detect suspicious behaviour
* Detect device manipulation
* Prevent automated abuse
* Protect government APIs
* Maintain complete audit trails
* Preserve evidentiary chain of custody
* Support investigation of fraudulent activity

---

# 3. Security Principles

Security by Default

Least Privilege

Zero Trust

Defense in Depth

Evidence First

Immutable Audit Trail

Configuration Driven

No Trust in Client

Every Request Verified

Every Action Logged

---

# 4. Security Layers

```text
Browser

↓

Authentication

↓

Authorization

↓

API Gateway

↓

Rate Limiter

↓

Input Validation

↓

Device Validation

↓

Evidence Validation

↓

AI Fraud Detection

↓

Workflow Engine

↓

Audit Logging

↓

Database
```

Every request passes through every applicable layer.

---

# 5. Threat Model

The platform shall defend against

* Fake reports
* Replay attacks
* Bot submissions
* GPS spoofing
* Screenshot uploads
* Gallery uploads
* AI-generated images
* Tampered metadata
* Account takeover
* API abuse
* Credential stuffing
* Denial of Service
* Privilege escalation
* Insider abuse

---

# 6. Authentication Security

Citizen

OTP Login

Department

Username + Password

Admin

Username + Password

Future

Passkeys

Government Identity

SSO

---

# 7. Session Security

JWT Tokens

Refresh Tokens

Idle Timeout

Device Binding

Forced Logout

Single Device Session (Configurable)

Refresh Token Rotation

---

# 8. Password Policy

Department/Admin Accounts

Minimum Length

12

Must contain

Uppercase

Lowercase

Number

Special Character

Password History

5 passwords

Expiry

90 Days

Citizen accounts use OTP only.

---

# 9. Authorization

Role Based Access Control

Permission Based Access

Department Isolation

Record Level Authorization

Every API validates

Authentication

Role

Permission

Ownership

Department

---

# 10. Device Fingerprinting

Each login records

Browser

Operating System

Screen Resolution

Timezone

Language

User Agent

Canvas Fingerprint (where supported)

WebGL Fingerprint (where supported)

Generated Device Identifier

Purpose

Risk Analysis

Account Protection

Fraud Detection

---

# 11. Browser Integrity Checks

Best-effort detection of

Developer Tools

Headless Browser

Automation Frameworks

Unusual Browser Flags

Unsupported Browser

Private Mode (where supported)

These checks contribute to risk scoring only.

---

# 12. GPS Validation

Validate

Latitude

Longitude

Accuracy

Timestamp

Speed

Heading

Altitude

Reject

Invalid Coordinates

Impossible Accuracy

Impossible Speed

Missing GPS

Mock GPS indicators (where detectable)

Store

Raw Coordinates

Resolved Address

Ward

District

State

---

# 13. Camera Security

Only browser camera APIs permitted.

Gallery upload prohibited.

File picker disabled.

Every image shall contain

Timestamp

GPS

Hash

Capture Metadata

Every video shall contain

Timestamp

GPS

Hash

Duration

Capture Metadata

---

# 14. Media Integrity

For every uploaded file generate

SHA-256

SHA-512

Perceptual Hash (Image)

Video Fingerprint

Media is immutable after upload.

Any modification creates a new version.

---

# 15. Evidence Chain of Custody

Every evidence file records

Capture Time

Upload Time

Uploader

Device

Location

Hash

Storage Path

Verification Status

Access History

No evidence may be overwritten.

---

# 16. AI Fraud Detection

AI shall evaluate

Synthetic Images

Repeated Images

Edited Images

Unrelated Images

Low Quality

Duplicate Evidence

Suspicious Objects

Risk Score

0-100

AI recommendations require moderator confirmation.

---

# 17. Duplicate Detection

Compare

Image Hash

Perceptual Hash

Location

Time Window

Objects Detected

Citizen

Device

Duplicate Confidence

Stored for every report.

---

# 18. Behaviour Analytics

Track

Reports Per Hour

Reports Per Day

Average Upload Time

Average Travel Speed

Login Frequency

Failed Logins

Repeated Categories

Device Changes

Location Changes

Behaviour anomalies increase fraud score.

---

# 19. Fraud Scoring

Score Range

0-100

Signals

Repeated Device

Modified Metadata

VPN

Tor

Rapid Submission

Duplicate Reports

Image Reuse

AI Flags

GPS Risk

Browser Automation

Risk Levels

0-25

Trusted

26-50

Monitor

51-75

Moderator Review

76-100

Restrict

Thresholds configurable.

---

# 20. Automated Responses

Trusted

Proceed

Monitor

Log Only

Review

Moderator Queue

High Risk

Rate Limit

Critical

Temporary Ban

Permanent bans require administrator approval.

---

# 21. Rate Limiting

Citizen APIs

60 requests/minute

OTP

5/hour

Report Submission

20/day

Anonymous Reports

10/day

Uploads

100 MB/hour

Rate limits configurable.

---

# 22. Abuse Detection

Detect

Repeated OTP Requests

API Scanning

Enumeration

Brute Force

Credential Stuffing

Mass Uploads

Replay Requests

Token Reuse

Suspicious User Agents

Automatic blocking supported.

---

# 23. Replay Protection

Every submission includes

Request ID

Nonce

Timestamp

Idempotency Key

Expired requests rejected.

---

# 24. API Security

HTTPS Only

TLS 1.3 Preferred

JWT Authentication

Input Validation

CSRF Protection (Web)

Rate Limiting

CORS Validation

Security Headers

---

# 25. HTTP Security Headers

Mandatory

Strict-Transport-Security

Content-Security-Policy

X-Frame-Options

X-Content-Type-Options

Referrer-Policy

Permissions-Policy

Cross-Origin Resource Policy

---

# 26. Data Encryption

In Transit

TLS

At Rest

Encrypted Object Storage

Sensitive Database Columns

Encrypted

API Keys

Encrypted

Secrets

Never stored in plaintext.

---

# 27. Personal Data Protection

PII includes

Name

Mobile

Email

Exact Coordinates

Device Identifier

Only authorized roles may access PII.

Public Portal shall never expose

Identity

Exact GPS

Media

Contact Details

---

# 28. Audit Logging

Record

Login

Logout

Failed Login

OTP

Report Creation

Assignment

Status Change

Configuration Change

AI Decision

Security Event

Export

Deletion Attempt

Audit records are append-only.

---

# 29. Security Events

Examples

Mock GPS

Repeated OTP

Browser Automation

Replay

Duplicate Media

VPN

Tor

Tampered Metadata

Privilege Escalation Attempt

API Abuse

Stored permanently.

---

# 30. Ban Management

Actions

Warn

Temporary Restriction

Temporary Ban

Permanent Ban

Every action records

Reason

Evidence

Administrator

Expiry

Appeal Status

---

# 31. Appeal Workflow

```text
Ban

↓

Citizen Appeal

↓

Administrator Review

↓

Decision

↓

Restore

or

Reject
```

All appeals audited.

---

# 32. File Security

Allowed Types

JPEG

PNG

MP4

MOV

Validate

Mime Type

Magic Bytes

Extension

Maximum Size

Virus Scan

Corrupted files rejected.

---

# 33. Logging & Monitoring

Monitor

Authentication

Authorization

Rate Limits

AI Providers

Storage

Queues

API Errors

Security Events

Alerts

Failed Jobs

Supports SIEM integration.

---

# 34. Security Dashboard

Displays

Active Sessions

Locked Users

Security Alerts

Fraud Trends

Rate Limited Users

Blocked Devices

Failed Logins

API Abuse

Storage Integrity

---

# 35. Compliance

Architecture shall support

OWASP Top 10

OWASP API Security Top 10

GDPR-style data handling

Indian DPDP Act readiness

Audit readiness

Future compliance modules may be added.

---

# 36. Incident Response

Incident Levels

Low

Medium

High

Critical

Workflow

Detect

↓

Record

↓

Notify

↓

Investigate

↓

Mitigate

↓

Resolve

↓

Audit

---

# 37. Backup Security

Encrypted Backups

Integrity Verification

Backup Rotation

Off-site Backup

Restore Verification

Immutable backup storage preferred.

---

# 38. Penetration Testing

Before production

Static Analysis

Dependency Scanning

Container Scanning

API Security Testing

Authentication Testing

Authorization Testing

Upload Testing

OWASP ZAP

Manual Penetration Testing

---

# 39. Future Security Enhancements

Passkeys

WebAuthn

Hardware Security Keys

Certificate Pinning (Native Apps)

On-device Integrity APIs

Behavioural Biometrics

Continuous Risk Scoring

ML-based Fraud Detection

---

# 40. Security Configuration

Administrators shall configure

Session Timeout

Password Policy

OTP Expiry

Rate Limits

Upload Limits

Risk Thresholds

Fraud Thresholds

Ban Policy

Retention Policy

Allowed Browsers

Allowed Countries

Feature Flags

All configuration shall be database-driven.

---

# 41. Definition of Done

The security subsystem shall be considered complete only when

* Authentication and authorization are enforced.
* Every API is protected.
* JWT lifecycle is implemented.
* Device fingerprinting is operational.
* GPS validation is implemented.
* Camera-only evidence capture is enforced.
* Evidence hashing is operational.
* Chain of custody is maintained.
* Fraud scoring is configurable.
* Rate limiting is enforced.
* Abuse detection is operational.
* Audit logs are immutable.
* Security events are searchable.
* Ban and appeal workflows are implemented.
* Encryption at rest and in transit is enabled.
* Security dashboards are operational.
* OWASP Top 10 mitigations are verified.
* Static analysis and penetration testing pass.
* No privileged action bypasses audit logging.
