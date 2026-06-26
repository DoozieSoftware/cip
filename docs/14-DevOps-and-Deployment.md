# 14 - Development Standards & DevOps Guide

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Draft

**Depends On**

* Documents 01–13

---

# 1. Purpose

This document defines the engineering standards, coding conventions, repository structure, development workflow, DevOps practices, deployment architecture, and quality gates for the Civic Intelligence Platform.

Every contributor, whether human or AI (Codex), shall follow this document.

This document is the engineering constitution of the project.

---

# 2. Engineering Principles

All code shall follow these principles.

* SOLID
* DRY
* KISS
* YAGNI
* Composition over Inheritance
* Convention over Configuration
* Configuration over Code
* Fail Fast
* API First
* Security First
* Test Driven where practical

---

# 3. Technology Stack

## Backend

Laravel 12

PHP 8.4

PostgreSQL 17

Redis

MinIO

Laravel Horizon

Laravel Scheduler

Sanctum

Spatie Permission

---

## Frontend

React 19

TypeScript

Vite

TailwindCSS v4

TanStack Query

React Hook Form

Zod

React Router

Apache ECharts

Leaflet

---

## Infrastructure

Docker

Docker Compose

Nginx

GitHub Actions

Supervisor

---

# 4. Repository Structure

```text
civic-platform/

backend/

frontend/

docs/

docker/

scripts/

.github/

.env.example

docker-compose.yml

README.md
```

No business logic outside backend or frontend.

---

# 5. Backend Folder Structure

```text
backend/

app/

Modules/

Shared/

Console/

Providers/

bootstrap/

config/

database/

routes/

storage/

tests/
```

Every module owns its code.

---

# 6. Module Structure

```text
Reports/

Controllers/

Requests/

Services/

Repositories/

Policies/

Events/

Listeners/

Jobs/

Models/

DTOs/

Resources/

Enums/

Observers/

Rules/

Tests/
```

Every module follows identical structure.

---

# 7. Controller Rules

Controllers shall

Validate Requests

Authorize

Call Service

Return Resource

Controllers shall NOT

Contain business logic

Query multiple modules

Access external APIs

Write raw SQL

Perform calculations

Maximum

150 lines.

---

# 8. Service Layer

All business logic belongs here.

Services shall

Contain transactions

Raise domain events

Call repositories

Coordinate workflows

Services shall never

Return HTTP responses.

---

# 9. Repository Rules

Repositories encapsulate persistence.

Allowed

Complex Queries

Search

Filtering

Pagination

Forbidden

Business Logic

Workflow Logic

Validation

---

# 10. DTO Standards

All complex requests shall use DTOs.

DTOs are immutable.

DTOs shall not depend on HTTP.

---

# 11. Form Requests

Every POST

PUT

PATCH

requires

Form Request Validation.

Validation never inside controllers.

---

# 12. API Resources

Every response uses

Laravel API Resources.

No model returned directly.

---

# 13. Database Standards

UUID primary keys

Foreign Keys mandatory

Soft Deletes where allowed

Indexes defined

Transactions required

No cascade delete for evidence

No nullable foreign keys unless justified

---

# 14. Migration Standards

One responsibility per migration.

Never edit old migrations.

Create new migrations.

Rollback mandatory.

---

# 15. Seeder Standards

Separate

Master Data

Demo Data

Development Data

Testing Data

No production secrets.

---

# 16. Queue Standards

Long-running work

must execute via queues.

Examples

AI

Notifications

Video Processing

OCR

External APIs

Analytics

Controllers shall never wait.

---

# 17. Event Standards

Every business event emits

Laravel Event.

Examples

ReportSubmitted

ReportAssigned

ReportClosed

AICompleted

NotificationSent

Events shall be immutable.

---

# 18. Exception Handling

Create domain exceptions.

Never expose stack traces.

Errors return

Code

Message

Trace ID

Support Contact

---

# 19. Logging Standards

Log Categories

Application

Audit

Security

AI

Integration

Performance

Never log

Passwords

OTP

JWT

Secrets

API Keys

PII

---

# 20. Configuration

Everything configurable.

Never hardcode

URLs

Departments

Categories

Workflows

AI Models

Timeouts

Credentials

Storage

---

# 21. Coding Standards

Backend

PSR-12

PHPStan Level Maximum

Laravel Pint

Strict Types

Type-safe Enums

Readonly properties where possible.

Frontend

ESLint

Prettier

Strict TypeScript

---

# 22. Naming Standards

Classes

PascalCase

Methods

camelCase

Variables

camelCase

Constants

UPPER_CASE

Database

snake_case

Routes

kebab-case

Components

PascalCase

Hooks

useCamelCase

---

# 23. Git Strategy

Branches

main

develop

feature/*

bugfix/*

release/*

hotfix/*

No direct commits to main.

---

# 24. Commit Convention

Format

```text
type(scope): description
```

Examples

```text
feat(report): add duplicate detection

fix(ai): correct confidence calculation

docs(api): update endpoints

test(workflow): add integration tests
```

---

# 25. Pull Requests

Every PR requires

Description

Linked Issue

Screenshots (UI)

Tests

Documentation Update

Passing CI

Minimum one reviewer.

---

# 26. Environment Variables

Never committed.

Secrets

API Keys

JWT Keys

Passwords

stored only in environment.

Provide

.env.example

---

# 27. Docker Standards

Containers

nginx

php

postgres

redis

minio

queue

scheduler

frontend

No application installed directly on host.

---

# 28. Docker Compose

Support

Development

Testing

Production

Single command

```text
docker compose up
```

starts complete platform.

---

# 29. CI/CD Pipeline

GitHub Actions

Pipeline

Install

↓

Lint

↓

Static Analysis

↓

Unit Tests

↓

Feature Tests

↓

Build

↓

Docker Build

↓

Security Scan

↓

Deploy

Deployment blocked on failure.

---

# 30. Static Analysis

Backend

PHPStan

Laravel Pint

Frontend

TypeScript

ESLint

Prettier

Zero warnings policy.

---

# 31. Dependency Management

Composer

NPM

Dependencies updated monthly.

Unused packages removed.

No abandoned packages.

---

# 32. Monitoring

Application

Database

Redis

Queue

AI

Storage

External APIs

Expose health endpoints.

---

# 33. Backup Strategy

Database

Daily

Storage

Daily

Configuration

Weekly

Retention configurable.

---

# 34. Performance Standards

API

<500ms

Dashboard

<2 seconds

Search

<500ms

AI Queue

Async

Memory leaks prohibited.

---

# 35. Security Standards

HTTPS only

JWT

CSRF

Rate Limiting

RBAC

Encrypted Secrets

Immutable Audit

Security review mandatory.

---

# 36. Testing Standards

Minimum Coverage

Backend

90%

Frontend

80%

Critical Modules

100%

Every bug

↓

Regression Test

---

# 37. Documentation Standards

Every module requires

README

Architecture

API

Configuration

Sequence Diagram

Change Log

Swagger

Documentation updated with code.

---

# 38. AI Coding Rules

AI-generated code shall

Follow architecture

Write tests

Update documentation

Never invent APIs

Never bypass services

Never duplicate logic

Never ignore validation

---

# 39. Forbidden Practices

No Business Logic in Controllers

No Business Logic in Components

No Direct SQL in Controllers

No Global State Abuse

No Hardcoded IDs

No Hardcoded URLs

No Magic Numbers

No Duplicate Code

No Disabled Tests

No Commented Production Code

No TODOs without issue references

No Force Push to Main

---

# 40. Definition of Done

A feature is complete only when

* Requirements implemented.
* Architecture followed.
* Unit tests pass.
* Feature tests pass.
* Static analysis passes.
* Lint passes.
* API documented.
* UI implemented.
* Accessibility verified.
* Audit logging added.
* Security reviewed.
* Performance acceptable.
* Documentation updated.
* CI pipeline passes.
* Code reviewed and approved.

---

# 41. AI Development Constitution

Every AI coding session shall follow this sequence.

```text
Read Relevant Specification

↓

Understand Module Boundaries

↓

Generate Implementation Plan

↓

Create Database Changes

↓

Implement Backend

↓

Implement Frontend

↓

Write Tests

↓

Run Static Analysis

↓

Fix Issues

↓

Update Documentation

↓

Commit

↓

Proceed to Next Task
```

The AI shall never implement features that contradict the specification documents.

If ambiguity exists, implementation shall stop and request clarification rather than making assumptions.

---

# 42. Architecture Compliance Checklist

Every pull request shall verify

✓ Module boundaries respected

✓ No controller business logic

✓ Services used correctly

✓ Policies enforced

✓ Validation implemented

✓ Events emitted

✓ Queues used for long-running work

✓ Audit logs generated

✓ Security reviewed

✓ Tests passing

✓ Documentation updated

Failure of any checklist item blocks merge.
