# Static quality baseline

The repository keeps a ratcheted baseline in
[`static-quality-baseline.json`](static-quality-baseline.json). It records the
current debt for PHPStan, ESLint, Prettier, and Pint so existing work can be
reduced incrementally without allowing a pull request to add more violations.

Run the same gate locally from the repository root:

```bash
bash scripts/check-static-quality-baseline.sh
```

The check runs the complete configured scope, compares the observed counts to
the checked-in limits, and fails when any count increases. Pint is intentionally
zero-tolerance because it has no stable count output. A baseline may only be
lowered in a separate, reviewable change that fixes the corresponding module;
never regenerate it wholesale after a failure. The captured date and command
scope are kept in the JSON file so reductions remain auditable.
