import { test, expect } from '@playwright/test';

/**
 * T-M13-025 — Citizen PWA push subscription.
 *
 * The Settings page calls `subscribeToPush()` and reports
 * a friendly toast. We don't actually grant notification
 * permission in the e2e shell; the JS contract is what
 * matters here.
 */

test.describe('citizen — push (T-M13-025)', () => {
  test('settings page renders push toggle', async ({ page }) => {
    await page.goto('/citizen/settings');
    // Page is lazy-loaded; wait for any push-related text.
    const push = page.getByText(/push notifications/i);
    await expect(push).toBeVisible();
  });
});
