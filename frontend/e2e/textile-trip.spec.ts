import { test, expect } from '@playwright/test';

/**
 * Phase 2 trip execution journeys.
 * Blocked journeys are fixme (OPEN D-05/D-06). Unblocked smoke asserts current dispatch board stays green.
 */

test.describe('E2E-3 pickup trip [OPEN D-05/D-06]', () => {
  test.fixme(true, 'approve → schedule → assign driver → reorder stops → collect w/ proof; manifest on 375px viewport');
});

test.describe('E2E-4 miss→reschedule loop (unblocked subset)', () => {
  test.fixme(true, 'mark missed → re-enter schedule queue → collect on trip 2 (batch_id detach/re-attach)');
});

test.describe('E2E-5 citizen cancel mid-trip', () => {
  test.fixme(true, 'cancel while staff opens manifest → one side wins, other shows conflict copy');
});

test.describe('E2E-6 cross-partner isolation [OPEN D-03]', () => {
  test.fixme(true, 'DEMO_EWASTE staff cannot open Dr. Linen trip URLs → 403/no leak');
});

test.describe('textile dispatch board smoke (unblocked)', () => {
  test('operations shell still renders without textile trip features', async ({ page }) => {
    await page.goto('/operations');
    await expect(page.locator('body')).toBeVisible();
  });
});
