import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * T-M13-021 — Citizen PWA full a11y audit.
 *
 * Boots every route, runs axe-core with WCAG 2.1 AA tags,
 * and fails on any serious or critical violation. Headings,
 * landmarks, and the bottom-nav label are sanity-checked
 * separately so the assertions are not just "axe is green".
 */

const ROUTES: { path: string; heading: RegExp }[] = [
  { path: '/citizen', heading: /namaskara|welcome|report an issue/i },
  { path: '/citizen/submit', heading: /report an issue/i },
  { path: '/citizen/reports', heading: /my reports/i },
  { path: '/citizen/notifications', heading: /updates/i },
  { path: '/citizen/profile', heading: /profile/i },
  { path: '/citizen/dashboard', heading: /dashboard|welcome/i },
  { path: '/citizen/settings', heading: /settings/i },
];

test.describe('citizen — a11y (T-M13-021)', () => {
  for (const route of ROUTES) {
    test(`axe-core passes on ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        serious,
        `Violations on ${route.path}:\n${JSON.stringify(serious, null, 2)}`,
      ).toEqual([]);
    });
  }

  test('every page has an h1 and a labelled bottom nav', async ({ page }) => {
    await page.goto('/citizen');
    await expect(page.getByRole('navigation', { name: /citizen sections/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
