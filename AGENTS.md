# AGENTS.md

## Civic Intelligence Platform

This repository is developed using **AI-first engineering**.

Every AI agent (Codex, ChatGPT, Claude Code, Gemini CLI, etc.) must follow this document before modifying any source code.

---

# Project Goal

Build a production-grade Civic Intelligence Platform that enables citizens to report civic issues using geo-tagged photographs and videos, routes reports through AI-assisted moderation, and integrates with government systems through configurable connectors.

This repository is specification-driven.

Specifications are the source of truth.

---

# Read Order

Before implementing ANY feature, read the following documents.

Mandatory

```
03 System Architecture

04 Database Design

05 REST API Specification

10 AI Vision Engine

11 Security & Anti Fraud

14 Development Standards
```

For UI

```
06 Citizen PWA

07 Moderator Portal

08 Operations Portal

09 Super Admin Portal

13 UI Design System
```

For integrations

```
12 External Connector Framework
```

Never skip reading specifications.

---

# Technology Stack

Backend

* Laravel 12
* PHP 8.4

Database

* MySQL 8.4

Queue

* Redis

Object Storage

* MinIO

Frontend

* React 19
* TypeScript
* Vite
* TailwindCSS v4

Charts

* Apache ECharts

Maps

* Leaflet

Authentication

* Laravel Sanctum

Authorization

* Spatie Permission

Testing

* PestPHP
* Playwright
* Vitest

Infrastructure

* Docker
* Docker Compose
* GitHub Actions

---

# Architecture Rules

Business Logic

→ Services

Persistence

→ Repositories

Validation

→ Form Requests

Authorization

→ Policies

Serialization

→ API Resources

Long Running Tasks

→ Queues

Events

→ Laravel Events

Never place business logic inside

Controllers

Components

Routes

Middleware

---

# Development Principles

Follow

SOLID

DRY

KISS

Convention over Configuration

Configuration over Code

Security First

API First

Test First where practical

---

# Coding Rules

Always

✔ Use strict typing

✔ Create Feature Tests

✔ Update Swagger

✔ Update Documentation

✔ Use DTOs

✔ Use Services

✔ Use Policies

✔ Emit Events

✔ Queue long-running tasks

Never

✘ Hardcode IDs

✘ Hardcode URLs

✘ Hardcode Departments

✘ Hardcode Categories

✘ Skip Validation

✘ Skip Authorization

✘ Skip Audit Logging

✘ Duplicate Logic

✘ Return Models directly

✘ Write SQL in Controllers

---

# Database Rules

Use

MySQL 8.4

InnoDB

utf8mb4

UUID Primary Keys

Foreign Keys

Indexes

Spatial Columns

POINT

POLYGON

Soft Deletes only where specified.

Never modify existing migrations.

Create new migrations.

---

# Frontend Rules

Use

Feature folders

Reusable Components

React Query

React Hook Form

Zod

Tailwind

No inline styles.

No duplicated components.

---

# Security Rules

Every endpoint requires

Authentication

Authorization

Validation

Audit Logging

Rate Limiting

Never expose

PII

Secrets

API Keys

JWT

Passwords

---

# AI Rules

AI never makes legal decisions.

AI only recommends.

Moderator always overrides AI.

Prompts must never be hardcoded.

Providers must be configurable.

---

# Connector Rules

Never call external APIs directly.

Always use Connector Framework.

Every integration must support

Retry

Timeout

Logging

Audit

Health Check

---

# Testing Rules

Every feature requires

Unit Test

Feature Test

Integration Test (where applicable)

Every bug requires

Regression Test

Coverage Targets

Backend

90%

Frontend

80%

---

# Before Every Commit

Verify

✓ Tests Pass

✓ Static Analysis Passes

✓ Lint Passes

✓ Documentation Updated

✓ Swagger Updated

✓ No TODOs

✓ No Dead Code

✓ No Debug Statements

---

# Pull Request Checklist

Every PR must include

Description

Acceptance Criteria

Tests

Migration Notes

Documentation

Screenshots (UI)

Swagger Changes

Security Review

---

# Implementation Order

Always build in this sequence

```
Migration

↓

Model

↓

Repository

↓

Service

↓

Policy

↓

Controller

↓

API Resource

↓

Tests

↓

Frontend

↓

Documentation
```

---

# When Unsure

Do NOT guess.

Do NOT invent APIs.

Do NOT invent database columns.

Do NOT invent workflows.

Stop implementation and request clarification.

Specifications always win over assumptions.

---

# Repository Philosophy

This is an enterprise platform.

Quality is more important than speed.

Maintainability is more important than cleverness.

Configuration is preferred over hardcoded logic.

Every change should improve the platform without introducing architectural debt.
