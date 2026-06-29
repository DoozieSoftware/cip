import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * T-M11-022 — Operations portal happy path.
 *
 * Structural smoke test: the operations portal shell
 * renders, the navigation links are reachable, and the
 * a11y gate passes. The full accept -> start -> resolve
 * -> close transition is covered in the backend E2E
 * tests (see `backend/tests/Feature/Departments/DepartmentEndpointsTest.php`).
 */
test.describe('Operations portal — shell', () => {
  test('lands on the dashboard with the operations nav', async ({ page }) => {
    await page.goto('/operations');
    await expect(page.getByRole('heading', { name: /department at a glance/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /assigned reports/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /export/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /department admin/i })).toBeVisible();
  });

  test('navigates to the assigned reports list', async ({ page }) => {
    await page.goto('/operations');
    await page.getByRole('link', { name: /assigned reports/i }).first().click();
    await expect(page).toHaveURL(/\/operations\/reports$/);
    await expect(page.getByRole('heading', { name: /assigned reports/i })).toBeVisible();
  });

  test('navigates to the export page', async ({ page }) => {
    await page.goto('/operations');
    await page.getByRole('link', { name: /^export$/i }).first().click();
    await expect(page).toHaveURL(/\/operations\/reports\/export$/);
    await expect(page.getByRole('heading', { name: /export reports/i })).toBeVisible();
  });

  test('navigates to the department admin page', async ({ page }) => {
    await page.goto('/operations');
    await page.getByRole('link', { name: /department admin/i }).first().click();
    await expect(page).toHaveURL(/\/operations\/admin$/);
    await expect(page.getByRole('heading', { name: /department admin/i })).toBeVisible();
  });

  test('keyboard shortcut hint is visible on the dashboard', async ({ page }) => {
    await page.goto('/operations');
    await expect(page.getByText(/keyboard:/i)).toBeVisible();
  });
});

test.describe('a11y — WCAG AA (operations)', () => {
  test('operations dashboard has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/operations');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
