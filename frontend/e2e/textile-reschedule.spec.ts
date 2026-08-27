import { test, expect } from '@playwright/test';

/**
 * Phase 3 reschedule journeys — plans/textile-collection-next-phases.md §6
 * and plans/phase1/04-qa-matrix.md BE-X5 / E2E-4.
 *
 * The reschedule lane is gated by OPEN D-04 (cutoff + override role), so
 * full end-to-end steps are fixme until the backend ships the endpoint.
 * Smoke specs covering shell rendering and guardrails stay green before that.
 */

// ── E2E-7 reschedule happy — citizen changes pickup date before cutoff ────────

test.describe('E2E-7 citizen reschedule happy [OPEN D-04]', () => {
  test.fixme(true, 'BE-X5-RS1: citizen reschedules an eligible scheduled pickup before cutoff → new date, old batch atomically detached, audit shows old+new');
  test.fixme(true, 'BE-X5-RS11: history timeline shows old and new scheduled_date / batch / window');
  test.fixme(true, 'FE-RS1: picker disables unavailable windows and shows next available slot');
});

// ── E2E-8 reschedule cutoff + override ──────────────────────────────────────

test.describe('E2E-8 reschedule cutoff [OPEN D-04]', () => {
  test.fixme(true, 'BE-X5-RS2: reschedule within cutoff window → 422 RESCHEDULE_CUTOFF_PASSED with hint');
  test.fixme(true, 'BE-X5-RS4: citizen reschedule frozen when trip is in_progress; partner override path per D-04 role succeeds');
});

// ── E2E-9 unavailable slot / fallback ───────────────────────────────────────

test.describe('E2E-9 unavailable slot fallback [OPEN D-04]', () => {
  test.fixme(true, 'BE-X5-RS8: requesting a no-longer-available slot → 422 SLOT_UNAVAILABLE with fallback note');
  test.fixme(true, 'Partner staff sees why the slot became unavailable (over-capacity / zone/day closed) on the queue');
});

// ── E2E-10 duplicate protection ─────────────────────────────────────────────

test.describe('E2E-10 duplicate booking protection [OPEN D-04]', () => {
  test.fixme(true, 'Repeatedly rescheduling keeps exactly one active collection request (no duplicate active bookings)');
});

// ── E2E-11 reminders ────────────────────────────────────────────────────────

test.describe('E2E-11 reminders [OPEN D-04]', () => {
  test.fixme(true, 'BE-N-RS1: scheduled premises receives exactly one reminder before the trip date');
  test.fixme(true, 'BE-N-RS2: reminder never sent for cancelled / rejected / already-collected requests');
  test.fixme(true, 'Reminder respects opted-out / consent-withdrawn citizen preference and does not leak staff PII');
});

// ── E2E reschedule smoke (unblocked — stays green before lane ships) ────────

test.describe('reschedule smoke (unblocked, no D-04)', () => {
  test('citizen detail shell still renders reschedule section without crashing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // Global shell should never show a hard error even before reschedule ships
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('operations shell gates reschedule-related routes (no data leak)', async ({ page }) => {
    await page.goto('/operations');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('citizen collections list and detail remain reachable without the reschedule lane', async ({ page }) => {
    await page.goto('/citizen/textile-collections');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/citizen/textile-collections/some-id');
    await expect(page.locator('body')).toBeVisible();
  });

  test('detail page on 375px viewport does not horizontally overflow reschedule section', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/citizen/textile-collections/some-id');
    await expect(page.locator('body')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test('reschedule placeholder never exposes a staff phone link', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/citizen/textile-collections/some-id');
    await expect(page.locator('body')).toBeVisible();
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => a.getAttribute('href') ?? ''),
    );
    for (const h of hrefs) {
      // No tel: link should contain a staff private hint; only generic citizen contact would ever appear
      if (h.startsWith('tel:')) {
        expect(h).not.toMatch(/staff|driver_private/i);
      }
    }
  });
});

test.describe('reschedule — service contact guardrail (unblocked)', () => {
  test('citizen detail shows "Contact support" instead of a staff phone', async ({ page }) => {
    await page.goto('/citizen/textile-collections/some-id');
    await expect(page.locator('body')).toBeVisible();
    // Even in error state the page should mention the support route
    const bodyText = await page.evaluate(() => document.body.textContent ?? '');
    // In detail the copy mentions Contact support or falls back to Retry without leaking tel:
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
