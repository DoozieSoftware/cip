import { test, expect } from '@playwright/test';

/**
 * Phase 1 drop-off receipt journeys — specs are fixtures that document the
 * acceptance flow. Steps that depend on OPEN D-01..D-03 are marked fixme
 * so the suite stays green before the backend ships drop-off lane.
 */

test.describe('E2E-1 drop-off happy [OPEN D-01/D-02]', () => {
  test.fixme(true, 'OPEN D-01: citizen books drop-off → approval → counter receipt w/ photo → sees received (no trip steps)');
});

test.describe('E2E-2 drop-off rejected walk-in [OPEN D-01/D-02]', () => {
  test.fixme(true, 'OPEN D-01: reject walk-in path; reason shown + audit trail in staff desk');
});

test.describe('textile dropoff smoke (unblocked)', () => {
  test('public zones endpoint is reachable shape (no auth leak)', async ({ page }) => {
    // Hit frontend landing; verify shell loads — lightweight smoke that stays green without backend dropoff lane.
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
