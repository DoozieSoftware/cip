import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * T-M13-023 — Citizen PWA structural smoke + a11y gate.
 *
 * Boots the citizen shell, validates the bottom nav is
 * reachable, and runs the WCAG AA axe scan. End-to-end
 * submission + offline + push tests live in
 * `citizen-offline.spec.ts` and `citizen-push.spec.ts`.
 */

test.describe('citizen — shell (T-M13-023)', () => {
  test('lands on the citizen home with the bottom nav', async ({ page }) => {
    await page.goto('/citizen');
    await expect(page.getByRole('navigation', { name: /citizen sections/i })).toBeVisible();
  });

  test('routes: home → reports → notifications → profile → settings', async ({ page }) => {
    await page.goto('/citizen');
    await expect(page.getByRole('link', { name: /my reports/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /updates/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('has no serious / critical axe violations on the home page', async ({ page }) => {
    await page.goto('/citizen');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
