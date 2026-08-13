# Dependency security policy

Dependency advisories are checked in CI from the locked Composer and npm manifests.

- Composer runs `composer audit --locked`; any advisory fails CI.
- npm runs `npm audit --omit=dev --audit-level=high`; high and critical production advisories fail CI.
- Lower-severity findings that cannot be upgraded without a breaking change must be recorded in `.security/dependency-exceptions.json`.
- Every exception needs an owner, reason, and expiry date. The register rejects expired entries and never permits a high/critical waiver.
- Exceptions are temporary release blockers, not a substitute for upgrading. Owners must renew or remove them before expiry.

The current exception is ECharts, whose fixed release is a major version upgrade and requires a chart compatibility pass.
