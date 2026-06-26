# 16 - Codex Implementation Roadmap & Execution Guide

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Final

**Depends On**

* Documents 01–15

---

# 1. Purpose

This document is the implementation guide for AI-assisted software development using Codex.

It defines:

* Repository bootstrap
* Milestone execution order
* Coding workflow
* Context documents to load
* Acceptance criteria
* AI implementation constraints

This document is the primary document read before every implementation session.

---

# 2. Technology Stack (Authoritative)

## Backend

* PHP 8.4
* Laravel 12
* MySQL 8.4 LTS
* Redis
* MinIO (S3 Compatible)
* Laravel Horizon
* Laravel Scheduler
* Sanctum
* Spatie Permission

> **Note:** This project uses **MySQL 8.4 LTS** as the authoritative database. Any earlier references to PostgreSQL or PostGIS in previous documents shall be interpreted as MySQL equivalents. Spatial features shall use MySQL Spatial (POINT, POLYGON, SPATIAL INDEX).

---

## Frontend

* React 19
* TypeScript
* Vite
* Tailwind CSS v4
* TanStack Query
* React Hook Form
* Zod
* React Router
* Apache ECharts
* Leaflet

---

## Infrastructure

* Docker
* Docker Compose
* Nginx
* GitHub Actions
* Supervisor

---

## AI

* Qwen-VL
* Blaxel
* Modal
* OpenAI Compatible APIs

---

# 3. Repository Structure

```text
civic-platform/

backend/
frontend/
docs/
docker/
scripts/
.github/

docker-compose.yml
README.md
```

---

# 4. Repository Bootstrap

Codex shall perform the following.

Create

```text
backend

frontend

docs

docker

scripts

.github
```

Initialize

Laravel

React

Docker

Git

CI Pipeline

No feature implementation begins until repository bootstrap is complete.

---

# 5. Development Rules

Before implementing any feature

Codex SHALL read

```
03 System Architecture

04 Database Design

05 REST API

10 AI Specification

11 Security

14 Development Standards
```

No implementation may violate these documents.

---

# 6. Milestone Overview

The platform shall be implemented incrementally.

```text
M1 Repository

↓

M2 Authentication

↓

M3 User Management

↓

M4 Master Configuration

↓

M5 Report Module

↓

M6 Media Upload

↓

M7 Workflow Engine

↓

M8 AI Pipeline

↓

M9 Moderator Portal

↓

M10 Operations Portal

↓

M11 Super Admin

↓

M12 Public Dashboard

↓

M13 External Connectors

↓

M14 Notifications

↓

M15 Security

↓

M16 Production Deployment
```

Each milestone shall produce production-quality code.

---

# 7. Milestone 1

Repository Bootstrap

Deliverables

Laravel

React

Docker

GitHub Actions

MySQL

Redis

MinIO

Authentication skeleton

Swagger

Health endpoint

Tests

---

# 8. Milestone 2

Authentication

Implement

OTP

JWT

Sanctum

Roles

Permissions

Profile

Session Management

Tests

Feature Tests

---

# 9. Milestone 3

User Management

Users

Roles

Permissions

Departments

Organizations

Settings

Audit

CRUD

Complete testing

---

# 10. Milestone 4

Master Configuration

Categories

Departments

Workflow

AI Providers

Routing Rules

Feature Flags

Settings

Seed Data

---

# 11. Milestone 5

Report Module

Reports

Location

Evidence

Timeline

Status

Assignments

Audit

Search

Filters

Pagination

---

# 12. Milestone 6

Media Module

Camera Upload

Image Processing

Video Upload

Metadata

Hashing

Storage

Thumbnail Generation

---

# 13. Milestone 7

Workflow Engine

State Machine

Approvals

Assignments

Escalations

Notifications

Audit

---

# 14. Milestone 8

AI Integration

Qwen-VL

OCR

Duplicate Detection

Fraud Detection

Summaries

Confidence

Provider Abstraction

---

# 15. Milestone 9

Moderator Portal

Dashboard

Review Queue

Duplicate Queue

Fraud Queue

Evidence Viewer

Assignment

Analytics

---

# 16. Milestone 10

Operations Portal

Department Dashboard

Reports

Assignments

Users

Analytics

GIS

Search

Exports

---

# 17. Milestone 11

Super Admin

Organizations

Settings

AI

Workflow

Integrations

Feature Flags

Monitoring

Health

---

# 18. Milestone 12

Public Dashboard

Statistics

Heat Maps

Department Performance

Area Reports

Public APIs

---

# 19. Milestone 13

External Connectors

Connector Framework

Mock Challan

Mock Municipality

Retry

DLQ

Health

Logs

---

# 20. Milestone 14

Notifications

Push

Email

SMS

Templates

Queue

Retry

Audit

---

# 21. Milestone 15

Security Hardening

Rate Limits

Fraud Detection

Risk Engine

Audit

Penetration Fixes

OWASP

Performance

---

# 22. Milestone 16

Production Readiness

CI/CD

Docker

Monitoring

Backup

Logging

Release

Documentation

---

# 23. AI Session Workflow

Every Codex session follows

```text
Read Specification

↓

Understand Existing Code

↓

Generate Task List

↓

Wait for Approval (if required)

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

Proceed
```

---

# 24. Implementation Constraints

Codex SHALL

Follow Architecture

Write Tests

Update Swagger

Update Documentation

Respect Module Boundaries

Respect Services

Respect Security Rules

Never invent APIs.

---

# 25. Forbidden Actions

Never

Modify architecture

Skip tests

Hardcode IDs

Hardcode URLs

Duplicate business logic

Mix modules

Disable authorization

Disable audit logging

Ignore specifications

Guess requirements

---

# 26. File Creation Rules

Every new module includes

Migration

Model

Factory

Seeder

Controller

Request

Resource

Service

Policy

Tests

Documentation

No partial modules.

---

# 27. Pull Request Checklist

Every PR includes

Description

Changed Files

Screenshots

Tests

Migration Notes

Documentation

Swagger Update

Performance Impact

Security Review

---

# 28. Testing Workflow

Run

Unit Tests

↓

Feature Tests

↓

Integration Tests

↓

Frontend Tests

↓

Lint

↓

Static Analysis

↓

Build

↓

Manual Review

↓

Commit

---

# 29. Definition of Done

A milestone completes only when

Requirements complete

Tests pass

Swagger updated

Documentation updated

CI passes

Security verified

Performance acceptable

Accessibility verified

Code reviewed

No TODOs remain

---

# 30. Development Order

The implementation sequence shall always be

```text
Database

↓

Models

↓

Repositories

↓

Services

↓

Policies

↓

Events

↓

Jobs

↓

Controllers

↓

Resources

↓

API Tests

↓

Frontend

↓

Integration Tests

↓

Documentation
```

Never build UI before APIs.

---

# 31. Documentation Updates

Every completed milestone updates

README

API Docs

Architecture

Database

Deployment

Release Notes

No undocumented changes.

---

# 32. Code Review Checklist

Review

Architecture

Performance

Security

Validation

Authorization

Audit

Testing

Accessibility

Error Handling

Documentation

---

# 33. Release Workflow

```text
Develop

↓

Feature Complete

↓

QA

↓

UAT

↓

Release Candidate

↓

Production

↓

Monitoring
```

Rollback plan mandatory.

---

# 34. Codex Prompt Template

Every implementation prompt should follow this structure:

```
You are implementing Milestone X of the Civic Intelligence Platform.

Read these documents before making any changes:

03 - System Architecture
04 - Database Design
05 - REST API Specification
10 - AI Vision Engine
11 - Security & Anti-Fraud
14 - Development Standards

Requirements

- Do not change architecture.
- Follow REST API exactly.
- Follow naming conventions.
- Follow Laravel standards.
- Use MySQL 8.4.
- Use Redis queues.
- Use MinIO storage.
- Write Pest feature tests.
- Update Swagger.
- Update documentation.

Deliverables

- Source code
- Tests
- Migration
- Documentation

Stop if any requirement is ambiguous.
```

---

# 35. Repository Bootstrap Commands

Backend

```bash
composer create-project laravel/laravel backend
```

Frontend

```bash
npm create vite@latest frontend
```

Containers

```bash
docker compose up -d
```

---

# 36. MySQL Standards

The project SHALL use

MySQL 8.4 LTS

Guidelines

* UUID primary keys
* InnoDB engine
* utf8mb4 character set
* utf8mb4_unicode_ci collation
* Foreign keys enforced
* Generated columns where beneficial
* Spatial data using MySQL Spatial
* POINT for GPS coordinates
* POLYGON for ward boundaries
* SPATIAL INDEX where supported
* Full-text indexes for report search
* JSON columns only for unstructured provider payloads

---

# 37. Success Criteria

The project is considered successfully implemented when

* All 16 specification documents are implemented.
* Every API matches the specification.
* Every workflow is configuration-driven.
* AI provider abstraction is operational.
* External connector framework is operational.
* Security controls are enforced.
* Test coverage targets are achieved.
* Production deployment succeeds using Docker Compose.
* The platform can be demonstrated end-to-end using mock integrations without code changes.

---

# 38. Final Instruction to Codex

The specification repository is the single source of truth.

If code and documentation conflict:

* The latest approved specification document takes precedence.

If specifications conflict:

* Stop implementation.
* Report the conflict.
* Request clarification.
* Never make assumptions.

The objective is to build a maintainable, enterprise-grade Civic Intelligence Platform that is modular, secure, AI-native, and configuration-driven.
