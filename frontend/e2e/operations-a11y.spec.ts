import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * T-M11-023 — Operations a11y audit.
 *
 * Per `docs/13` §31 the operations portal must clear WCAG 2.1 AA
 * with no serious / critical violations. We mock the API and walk
 * each top-level route to assert the gate passes on every surface.
 */

const PAGES: Array<{ path: string; heading: RegExp }> = [
  { path: '/operations', heading: /department at a glance/i },
  { path: '/operations/reports', heading: /assigned reports/i },
  { path: '/operations/analytics', heading: /analytics/i },
  { path: '/operations/security', heading: /security dashboard/i },
  { path: '/operations/audit', heading: /audit log/i },
  { path: '/operations/admin', heading: /department admin/i },
  { path: '/operations/reports/export', heading: /export reports/i },
];

async function mockCommonApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('cip_token', 'test-token');
  });

  // Catch-all dashboard endpoint.
  await page.route('**/api/v1/department/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { open: 0, due_today: 0, sla_breached: 0, by_category: {} },
      }),
    });
  });

  // Catch-all list endpoint.
  await page.route('**/api/v1/department/reports?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
        meta: { current_page: 1, per_page: 20, total: 0, last_page: 1 },
      }),
    });
  });

  // Catch-all security dashboard.
  await page.route('**/api/v1/admin/security/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          failed_logins: { count: 0, recent: [] },
          locked_accounts: { count: 0, recent: [] },
          mock_gps_reports: { count: 0, recent: [] },
          spam_detection: { count: 0, recent: [] },
          rate_limited_users: { count: 0, recent: [] },
          suspicious_devices: { count: 0, recent: [] },
          blocked_users: { count: 0, recent: [] },
          security_alerts: { count: 0, recent: [] },
          generated_at: new Date().toISOString(),
        },
      }),
    });
  });

  // Catch-all audit-logs.
  await page.route('**/api/v1/admin/audit-logs**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
        meta: { current_page: 1, per_page: 50, total: 0, last_page: 1 },
      }),
    });
  });
}

test.describe('Operations a11y — WCAG 2.1 AA', () => {
  for (const p of PAGES) {
    test(`${p.path} has no serious/critical violations`, async ({ page }) => {
      await mockCommonApis(page);
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    });
  }
});
