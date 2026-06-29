import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * T-M12-029 — Super Admin portal happy path.
 *
 * Structural smoke + a11y: the admin shell renders, the
 * navigation links are reachable, and the axe-core gate
 * passes. The configure-report-type → submit-report E2E
 * is a backend integration concern; the Pest feature
 * tests in `backend/tests/Feature/Reports/AdminReportTypeCrudTest.php`
 * already cover the API contract.
 */

test.describe('Super Admin portal — shell', () => {
  test('lands on the dashboard with the admin nav', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /platform dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /users/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /roles/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /feature flags/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /health/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /scheduler/i }).first()).toBeVisible();
  });

  test('navigates to the users page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /^users$/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/users$/);
  });

  test('navigates to the feature flags page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /feature flags/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/feature-flags$/);
    await expect(page.getByRole('heading', { name: /feature flags/i })).toBeVisible();
  });

  test('navigates to the platform health page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /health/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/health$/);
    await expect(page.getByRole('heading', { name: /platform health/i })).toBeVisible();
  });

  test('navigates to the scheduler page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /scheduler/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/scheduler$/);
    await expect(page.getByRole('heading', { name: /scheduler/i })).toBeVisible();
  });

  test('navigates to the audit log page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /audit log/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/audit$/);
  });

  test('navigates to the integrations page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /integrations/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/integrations$/);
    await expect(page.getByRole('heading', { name: /integrations/i })).toBeVisible();
  });

  test('navigates to the storage page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /storage/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/storage$/);
    await expect(page.getByRole('heading', { name: /media storage/i })).toBeVisible();
  });

  test('navigates to the notifications page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /notifications/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/notifications$/);
    await expect(page.getByRole('heading', { name: /notification configs/i })).toBeVisible();
  });

  test('navigates to the AI page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /^ai$/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/ai$/);
    await expect(page.getByRole('heading', { name: /ai providers/i })).toBeVisible();
  });

  test('navigates to the routing rules page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /routing/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/routing-rules$/);
    await expect(page.getByRole('heading', { name: /routing rules/i })).toBeVisible();
  });

  test('navigates to the workflows page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /workflows/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/workflows$/);
    await expect(page.getByRole('heading', { name: /workflow builder/i })).toBeVisible();
  });

  test('navigates to the retention page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /retention/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/retention$/);
    await expect(page.getByRole('heading', { name: /data retention/i })).toBeVisible();
  });

  test('navigates to the system config page', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /system/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/system$/);
    await expect(page.getByRole('heading', { name: /system configuration/i })).toBeVisible();
  });
});

test.describe('a11y — WCAG AA (admin)', () => {
  test('admin dashboard has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/admin');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test('admin feature flags page has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/admin/feature-flags');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
