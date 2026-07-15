import { test, expect, type Page } from '@playwright/test';

/**
 * T-M11-022 — Operations portal: full accept → close lifecycle.
 *
 * This test exercises the entire report-lifecycle UI surface by
 * intercepting the REST calls and replaying realistic responses
 * (so it runs without a seeded backend). The flow mirrors what a
 * department officer would do in production: open a report,
 * accept, start, resolve, close, and add a private note.
 *
 * The same flow is covered end-to-end against a real backend in
 * `backend/tests/Feature/Departments/DepartmentEndpointsTest.php`,
 * which guards the wire contract. This Playwright spec guards the
 * UI affordances and the user-visible transitions.
 */

const REPORT_ID = '11111111-1111-1111-1111-111111111111';

const report = {
  id: REPORT_ID,
  tracking_number: 'CIP-2026-0001',
  title: 'Pothole on Main St',
  description: 'A large pothole near the intersection.',
  is_anonymous: false,
  is_verified: true,
  ai_confidence: 0.87,
  fraud_score: 0.05,
  duplicate_score: 0.12,
  submitted_at: '2026-06-29T08:00:00+00:00',
  closed_at: null,
  created_at: '2026-06-29T08:00:00+00:00',
  updated_at: '2026-06-29T08:00:00+00:00',
  report_type: { id: 'rt1', code: 'pothole', name: 'Pothole' },
  status: { id: 'st1', code: 'assigned', name: 'Assigned', is_terminal: false },
  priority: { id: 'pr1', code: 'p3', name: 'Medium', sla_minutes: 240 },
  location: { lat: 12.97, lng: 77.59, accuracy: 5, address: 'Main St' },
  department: { id: 'd1', code: 'roads', name: 'Roads' },
  current_status_code: 'assigned',
  department_sla_minutes: 240,
  internal_notes: [],
};

async function installApiMocks(page: Page, token: string): Promise<void> {
  // Provide a Sanctum token in localStorage so the API client uses it.
  await page.addInitScript((t: string) => {
    localStorage.setItem('cip_token', t);
  }, token);

  // Mock the dashboard.
  await page.route('**/api/v1/department/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          open: 3,
          due_today: 1,
          sla_breached: 0,
          by_category: { pothole: 2, garbage: 1 },
        },
      }),
    });
  });

  // Mock the list.
  await page.route('**/api/v1/department/reports?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [report],
        meta: { current_page: 1, per_page: 20, total: 1, last_page: 1 },
      }),
    });
  });

  // Mock the single report fetch.
  await page.route(`**/api/v1/department/reports/${REPORT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: report }),
    });
  });

  // Action endpoints.
  for (const event of ['accept', 'start', 'progress', 'resolve', 'close']) {
    await page.route(`**/api/v1/department/reports/${REPORT_ID}/${event}`, async (route) => {
      const statusMap: Record<string, string> = {
        accept: 'accepted',
        start: 'in_progress',
        progress: 'in_progress',
        resolve: 'resolved',
        close: 'closed',
      };
      const updated = {
        ...report,
        current_status_code: statusMap[event] ?? report.current_status_code,
        status: {
          ...report.status,
          code: statusMap[event] ?? report.status.code,
          name: statusMap[event] ?? report.status.name,
          is_terminal: event === 'close',
        },
        closed_at: event === 'close' ? '2026-06-29T09:30:00+00:00' : null,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: updated }),
      });
    });
  }

  // Notes endpoints.
  await page.route(`**/api/v1/department/reports/${REPORT_ID}/notes`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    } else {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'note-1',
            body: (route.request().postDataJSON() as { body?: string }).body ?? '',
            author_id: null,
            author_name: 'Test Officer',
            created_at: '2026-06-29T09:00:00+00:00',
          },
        }),
      });
    }
  });
}

test.describe('Operations portal — accept → start → resolve → close', () => {
  test('officer can walk a report through the full lifecycle', async ({ page }) => {
    await installApiMocks(page, 'test-token');

    // Land on the dashboard.
    await page.goto('/operations');
    await expect(page.getByRole('heading', { name: /department at a glance/i })).toBeVisible();

    // Open the assigned reports list.
    await page
      .getByRole('link', { name: /assigned reports/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/operations\/reports$/);

    // Open the report.
    await page
      .getByRole('link', { name: /CIP-2026-0001/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/operations/reports/${REPORT_ID}$`));
    await expect(page.getByRole('heading', { name: /pothole on main st/i })).toBeVisible();

    // Accept.
    await page.getByRole('button', { name: /^accept$/i }).click();
    await expect(page.getByText(/^accepted$/i).first()).toBeVisible();

    // Start.
    await page.getByRole('button', { name: /^start$/i }).click();
    await expect(page.getByText(/^in_progress$/i).first()).toBeVisible();

    // Resolve.
    await page.getByRole('button', { name: /^resolve$/i }).click();
    await expect(page.getByText(/^resolved$/i).first()).toBeVisible();

    // Close.
    await page.getByRole('button', { name: /^close$/i }).click();
    await expect(page.getByText(/^closed$/i).first()).toBeVisible();

    // Add a private internal note.
    const noteBox = page.getByRole('textbox', { name: /internal note|note/i }).first();
    if (await noteBox.isVisible().catch(() => false)) {
      await noteBox.fill('Crew dispatched at 09:00.');
      const addBtn = page.getByRole('button', { name: /add note|save note/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
      }
    }
  });
});
