# 03 - System Architecture Specification

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Draft

**Depends On:**

* 01 - Product Vision
* 02 - Product Requirements Document

---

# 1. Purpose

This document defines the complete software architecture of the Civic Intelligence Platform.

It specifies the technologies, architectural principles, module boundaries, deployment model, integration strategy, scalability approach, and coding constraints.

This document is the authoritative architectural reference for all implementation.

---

# 2. Architecture Principles

The platform shall follow these principles.

* API First
* Configuration over Code
* Modular Monolith
* Domain Driven Design
* REST Architecture
* Queue Driven Processing
* Event Based Workflows
* Secure by Default
* AI as a Service
* Cloud Agnostic
* Storage Agnostic

---

# 3. High Level Architecture

```text
                Flutter Citizen App
                       │
                       │ REST
                       ▼

                Laravel API Gateway
                       │
 ┌─────────────────────┼──────────────────────┐
 │                     │                      │
 ▼                     ▼                      ▼

Workflow Engine     AI Engine         Notification Engine

 │                     │                      │

 ▼                     ▼                      ▼

Routing Engine    External AI      Push / Email / SMS

 │

 ▼

Department Services

 │

 ▼

Database + Object Storage

 │

 ▼

Public Dashboard APIs
```

---

# 4. Applications

The system consists of five deployable applications.

## Citizen Mobile App

Technology

Flutter

Responsibilities

* Authentication
* Evidence Capture
* Offline Queue
* Report Tracking

---

## Backend

Technology

Laravel

Responsibilities

* REST APIs
* Authentication
* Workflow
* AI
* Routing
* Integrations

---

## Moderator Portal

Technology

React

Responsibilities

* AI Review
* Fraud Review
* Duplicate Management

---

## Department Portal

Technology

React

Responsibilities

* Issue Resolution
* Dashboard
* Evidence Viewer

---

## Public Portal

Technology

React PWA

Responsibilities

* Statistics
* Heat Maps
* Public Reports

---

# 5. Backend Architecture

The backend shall remain a Modular Monolith.

No microservices in Version 1.

Reasons

* Easier deployment
* Lower operational cost
* Faster development
* Simpler debugging
* Shared transactions

Modules communicate through services and events.

---

# 6. Backend Modules

The Laravel application shall contain the following modules.

Authentication

Users

Reports

Media

Departments

Workflow

Routing

Moderation

Notifications

AI

Integrations

Analytics

Administration

Audit

Security

Settings

Each module shall own

* Models
* Controllers
* Services
* Policies
* Events
* Jobs
* Requests
* Resources
* Tests

Modules shall never directly access another module's database models.

Communication shall occur through services or events.

---

# 7. AI Architecture

AI shall never be tightly coupled.

```text
Report

↓

AI Service

↓

Provider Interface

↓

Provider

↓

Result

↓

Workflow
```

Providers

* Qwen VL
* OpenAI Compatible APIs
* Blaxel
* Modal
* Ollama (Future)

Switching providers shall require configuration only.

---

# 8. Integration Architecture

External systems shall connect through connectors.

Connector Interface

↓

REST Connector

↓

SOAP Connector

↓

Government API

↓

Mock API

Every connector supports

* Retry
* Timeout
* Queue
* Audit
* Logging

---

# 9. Workflow Engine

Every report moves through a configurable workflow.

Workflow Rules

↓

State Machine

↓

Permissions

↓

Notifications

↓

Audit

↓

Next State

Workflow definitions shall not be hardcoded.

---

# 10. Routing Engine

Routing depends on

Category

Ward

District

State

Department

Severity

Configuration

Routing logic shall be database driven.

---

# 11. Database

Primary Database

PostgreSQL

GIS

PostGIS

Object Storage

MinIO

Cache

Redis

Queue

Redis

Search

Database search in Version 1.

ElasticSearch may be added later.

---

# 12. Storage Strategy

Evidence files

Images

Videos

Documents

shall never be stored inside the database.

Only metadata shall be stored.

Object storage shall support

* Local
* MinIO
* AWS S3
* Azure Blob

through Laravel Storage.

---

# 13. Authentication

Citizen

OTP

Moderator

Username + Password

Department

Username + Password

Admin

Username + Password

Future

SSO

OAuth

Government Identity

---

# 14. Authorization

Laravel Policies

Spatie Permission

RBAC

Every API must verify

Authentication

Authorization

Department Scope

Ownership

---

# 15. Queue Architecture

Long running tasks shall execute through queues.

Examples

AI Processing

Video Processing

OCR

Notification

API Calls

Thumbnail Generation

Report Analytics

No HTTP request shall wait for AI completion.

---

# 16. Event Architecture

Examples

ReportSubmitted

↓

AIRequested

↓

AICompleted

↓

DepartmentAssigned

↓

NotificationSent

↓

AuditRecorded

All major business events shall be emitted.

---

# 17. Notification Architecture

Notification Interface

↓

Push

↓

Email

↓

SMS

Notification providers shall be configurable.

---

# 18. Logging

Application Logs

API Logs

Audit Logs

Security Logs

AI Logs

Integration Logs

Each log category shall remain independent.

---

# 19. Audit Trail

Every important action shall create immutable audit records.

Examples

Login

Logout

Report Created

Status Changed

AI Decision

Moderator Decision

Department Decision

API Call

Configuration Change

Deletion

---

# 20. Error Handling

Errors shall return

HTTP Status

Machine Code

User Message

Developer Message

Reference ID

Stack traces shall never be exposed.

---

# 21. Performance Targets

API

<500ms

Authentication

<300ms

Dashboard

<2s

AI Processing

<30s

File Upload

<10s

---

# 22. Scalability

The architecture shall support

Horizontal API scaling

Multiple queue workers

Multiple AI providers

Multiple storage providers

Multiple database replicas

No architectural redesign should be required.

---

# 23. Security Architecture

Security layers

Transport

Authentication

Authorization

Input Validation

Device Validation

Fraud Detection

Rate Limiting

Audit

Encryption

All APIs require HTTPS.

---

# 24. Deployment

Docker Compose

↓

Nginx

↓

Laravel

↓

Redis

↓

PostgreSQL

↓

MinIO

↓

Queue Workers

↓

Scheduler

Single server deployment shall be supported.

---

# 25. Folder Structure

```text
backend/

app/

Modules/

Authentication/

Reports/

AI/

Workflow/

Departments/

Moderation/

Integrations/

Media/

Notifications/

Analytics/

Administration/

Security/

Shared/

bootstrap/

config/

database/

routes/

storage/

tests/
```

---

# 26. Coding Constraints

Mandatory

PSR-12

SOLID

Dependency Injection

Repository Pattern where appropriate

Service Classes

Form Requests

API Resources

Policies

Queues

Events

Forbidden

Business Logic inside Controllers

Raw SQL in Controllers

Direct File Access

Hardcoded Configuration

Business Logic inside Blade Templates

Business Logic inside React Components

---

# 27. Technology Stack

Backend

Laravel 12

PHP 8.4

Frontend

React

TypeScript

Mobile

Flutter

Database

PostgreSQL + PostGIS

Cache

Redis

Storage

MinIO

Queue

Redis

Maps

OpenStreetMap

Leaflet

AI

Qwen VL

Container

Docker

CI

GitHub Actions

---

# 28. Future Evolution

When scale requires, modules may be extracted into microservices.

Candidate services

AI

Notifications

Analytics

Media Processing

Search

Integration Gateway

This migration shall not affect API contracts.

---

# 29. Definition of Architecture Compliance

Every pull request shall be rejected if it

Introduces business logic into controllers

Introduces hardcoded routing

Violates module boundaries

Bypasses services

Skips authorization

Skips audit logging

Uses direct database access across modules

Introduces provider-specific AI logic outside the AI abstraction layer

Violates naming conventions or coding standards
