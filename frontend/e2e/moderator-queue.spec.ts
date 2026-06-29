import { test, expect } from '@playwright/test';

/**
 * T-M10-025 — Moderator happy path.
 *
 * This is a structural smoke test that exercises the moderator portal
 * with the dev server running. It asserts the layout shell renders, the
 * navigation links are reachable, and the keyboard-shortcut hint is
 * visible. The full approval/merge/reject flow needs a seeded backend
 * with a valid Sanctum token and is covered in the backend E2E tests
 * (see `backend/tests/Feature/Moderation/ModerationEndpointsTest.php`).
 */
test.describe('Moderator portal — shell', () => {
  test('lands on the dashboard with the moderator nav', async ({ page }) => {
    await page.goto('/moderator');
    await expect(page.getByRole('heading', { name: /today at a glance/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /review queue/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /duplicates/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /fraud/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /analytics/i })).toBeVisible();
  });

  test('navigates to the review queue', async ({ page }) => {
    await page.goto('/moderator');
    await page.getByRole('link', { name: /review queue/i }).first().click();
    await expect(page).toHaveURL(/\/moderator\/queue$/);
    await expect(page.getByRole('heading', { name: /review queue/i })).toBeVisible();
  });

  test('keyboard shortcut hint is visible on the queue page', async ({ page }) => {
    await page.goto('/moderator/queue');
    await expect(page.getByText(/keyboard:/i)).toBeVisible();
  });
});
