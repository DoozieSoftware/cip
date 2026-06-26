# Master Data Strategy

**Project:** Civic Intelligence Platform
**Version:** 1.0
**Status:** Live
**Source Specs:** `docs/04` §8, `docs/09` §7, §18, `docs/14` §37, `AGENTS.md`

This document explains how master data is added, edited, and rolled out across the Civic Intelligence Platform. It is the on-ramp for the Super Admin Portal (M12) and the operations team.

## 1. The Two Source-of-Truth Rules

1. **The database is the only source of truth for master data.** No country, state, district, city, zone, ward, department, category, or feature flag is ever hardcoded in source.
2. **Every write goes through a service that emits an event.** A bare `Model::create()` in a seeder is acceptable only when the seeder is re-runnable (`updateOrCreate` / `firstOrCreate`) and idempotent.

The same rules apply to:

| Master | Module | Primary model | Public read path |
| --- | --- | --- | --- |
| Geography tree | Departments | `Country`, `State`, `District`, `City`, `Zone`, `Ward` | `GET /api/v1/master-config` (M3-019) |
| Departments | Departments | `Department` | `GET /api/v1/master-config` |
| Settings | Settings | `Setting` | `SettingsService::get()` |
| Feature flags | Settings | `AppConfig` | `FeatureFlagService::enabled()` |
| Categories / sub-categories (M4) | Reports | `Category`, `SubCategory` | `GET /api/v1/master-config` |
| SLA policies (M6) | Workflow | `SlaPolicy` | `GET /api/v1/master-config` |
| Workflow definitions (M6) | Workflow | `WorkflowDefinition` | `GET /api/v1/master-config` |

## 2. Adding a Country, State, District, City, or Ward

The geography tree is hierarchical; the smallest unit is the ward. Every level uses `updateOrCreate` on a natural key so an out-of-order run is safe.

### 2.1 Add a country (Super Admin)

`POST /api/v1/admin/geography/countries`

```json
{
  "name": "India",
  "iso2": "IN",
  "iso3": "IND",
  "phone_code": "+91",
  "active": true
}
```

* `iso2` is the natural key — it must be unique across `countries`.
* The model normalises `iso2` to upper-case.
* A `Country` cannot be deleted once a child `State` exists; soft-disable (`active: false`) instead.

### 2.2 Add a state (Super Admin)

`POST /api/v1/admin/geography/states`

```json
{
  "country_id": "<uuid>",
  "code": "KA",
  "name": "Karnataka",
  "active": true
}
```

* `(country_id, code)` is the natural key.

### 2.3 Add a district, city, or zone (Super Admin)

Same shape, deeper parent.

```json
// District
{ "state_id": "<uuid>", "code": "KA-BU", "name": "Bangalore Urban" }
// City
{ "district_id": "<uuid>", "code": "BLR-CITY", "name": "Bengaluru" }
// Zone
{ "city_id": "<uuid>", "code": "BLR-EAST", "name": "East Zone" }
```

### 2.4 Add a ward (Super Admin)

Wards are the only level that carries a `boundary_polygon` and the only level that uses `SoftDeletes`.

`POST /api/v1/admin/geography/wards`

```json
{
  "city_id": "<uuid>",
  "zone_id": "<uuid>",
  "ward_number": 1,
  "name": "Jeevan Bima Nagar",
  "municipality": "BBMP",
  "boundary_polygon": "POLYGON((77.59 12.97,77.60 12.97,77.60 12.98,77.59 12.98,77.59 12.97))"
}
```

* `(city_id, ward_number)` is the natural key — `ward_number` re-starts at 1 per city.
* `boundary_polygon` is application-level WKT (see D-020). MySQL stores it as a `POLYGON` with a spatial index; SQLite falls back to TEXT.
* Soft-deleting a ward is reversible; force-deleting a ward is blocked when child reports exist.

## 3. Adding a Department

`POST /api/v1/admin/departments`

```json
{
  "name": "Bengaluru Electricity Supply Company",
  "code": "BESCOM",
  "jurisdiction": "BESCOM",
  "default_sla_minutes": 1440,
  "escalation_matrix": [
    { "after_minutes": 720,  "escalate_to": "BESCOM-AEE" },
    { "after_minutes": 2880, "escalate_to": "BESCOM-EE"  }
  ],
  "working_hours": { "mon": ["09:00", "17:00"], "tue": ["09:00", "17:00"] },
  "holiday_calendar": ["2026-01-26", "2026-08-15"]
}
```

* `code` is the natural key — keep it short (≤ 32 chars) and uppercase.
* `default_sla_minutes` is used by the Workflow engine (M6) when the report has no `SlaPolicy` match.
* `escalation_matrix` is an array of `{after_minutes, escalate_to}` rows. The Workflow engine walks it in order; each row fires `DepartmentEscalated` (T-M6-*).
* `working_hours` and `holiday_calendar` are pure data — the Workflow engine treats them as a set; no business logic lives in the model.

### 3.1 Routing a category to a department

Once a department exists, the Routing engine (M7) needs to know which categories it owns. Use the routing rule endpoint (T-M7-*):

`POST /api/v1/admin/routing/rules`

```json
{
  "category_id": "<uuid>",
  "department_id": "<uuid>",
  "priority": 1
}
```

* `priority` is the disambiguation hint when multiple rules match a report.
* Routing rules are evaluated in `priority ASC` order; the first match wins.

## 4. Adding a Setting

Settings are arbitrary `key` / `value` / `type` triples the application reads at runtime. There is no `code` — the natural key is the dotted `key` itself.

`POST /api/v1/admin/settings`

```json
{
  "key": "ai.vision.provider",
  "value": "openai",
  "type": "string",
  "description": "Primary vision provider",
  "is_public": false
}
```

* `type` is one of `string`, `int`, `bool`, `json`, `datetime`. It tells the reader how to coerce the JSON-encoded `value` back into a PHP scalar.
* `is_public: true` settings are returned by `GET /api/v1/master-config` without authentication; default is `false`.
* Every write goes through `SettingsService::set()` which invalidates the `settings:<key>` cache entry. The next `get()` reads from the database.

## 5. Adding a Feature Flag

Feature flags are not for application data — they exist to gate a feature on or off per-user.

`POST /api/v1/admin/app-configs`

```json
{
  "key": "ai.vision.enabled",
  "enabled": true,
  "rollout_percentage": 25,
  "cohort": [
    { "role": "super_admin" }
  ],
  "value": { "providers": ["openai", "local"] },
  "description": "Phase-1 vision rollout"
}
```

Evaluation order (`FeatureFlagService::enabled`):

1. `enabled` master switch — if false, return false.
2. `cohort` match — if the user matches at least one predicate, return true (the user is "opted in" regardless of `rollout_percentage`).
3. `rollout_percentage` — compute `SHA-256("{key}:{userId|sessionId|anon}") mod 100` and compare to the bucket size. The same user always gets the same answer for the same key.

A test plan for a new flag:

1. Create the flag with `enabled: false, rollout_percentage: 0`. Verify `FeatureFlagService::enabled(...)` returns false.
2. Flip to `enabled: true, rollout_percentage: 0`. Verify the flag is still false (the master switch flips, but the bucket size is 0).
3. Flip to `rollout_percentage: 100`. Verify the flag is true for every user.
4. Set `rollout_percentage: 50` and verify the same user always gets the same answer.

## 6. Reseeding for Local Development

The full master-data set ships as seeders wired into `DatabaseSeeder`:

```bash
php artisan db:seed
```

Idempotency guarantees:

| Seeder | Strategy | Re-runnable? |
| --- | --- | --- |
| `RolesAndPermissionsSeeder` | `firstOrCreate` + `syncPermissions` | yes |
| `CountriesSeeder` | `firstOrCreate(['iso2'], …)` | yes |
| `GeographySeeder` | `updateOrCreate` on natural key per level | yes |
| `DepartmentsSeeder` | `DepartmentService::create` or `update` | yes |
| `AppConfigsSeeder` | `updateOrCreate(['key'], …)` | yes |

A full local reset is:

```bash
php artisan migrate:fresh --seed
```

## 7. Production Rollout Checklist

Before a master-data change is merged:

- [ ] Migration added (DB schema) — never modify an existing migration.
- [ ] Model + factory + seeder updated.
- [ ] Repository + service updated (no business logic in controllers).
- [ ] Policy + Form Request updated.
- [ ] Resource / DTO updated.
- [ ] OpenAPI YAML updated.
- [ ] Pest feature test added.
- [ ] Pint clean; PHPStan clean; full suite green.
- [ ] PR description lists the new endpoints and the cache-invalidation impact.
- [ ] Master-config endpoint smoke-tested (cache hit + miss paths).
