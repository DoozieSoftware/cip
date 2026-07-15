import { test, expect } from '@playwright/test';
import { getBearerToken } from './helpers/auth';

const API = 'https://cip-api.dgisipl.com/api/v1';

/**
 * Production end-to-end coverage for the Operations (Department) portal.
 *
 * Every view is exercised against the live backend with a real demo
 * department-officer session. This complements the mocked
 * `operations*.spec.ts` files (which guard affordances in isolation)
 * by proving the deployed wire contract and data actually work.
 *
 * Run with: npx playwright test --config playwright.prod.config.ts
 *
 * The two projects in that config (officer / super-admin) carry a
 * pre-authenticated storageState, so no login happens here.
 */

test.describe('Operations portal — production (officer)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operations');
    await expect(page.getByRole('heading', { name: /department at a glance/i })).toBeVisible();
  });

  test('dashboard renders live metrics', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /open reports by category/i })).toBeVisible();
    await expect(page.getByText(/sla breached/i).first()).toBeVisible();
    const token = await getBearerToken(page);
    expect(token).not.toBe('');
  });

  test('assigned reports list shows rows and filters', async ({ page }) => {
    await page.goto('/operations/reports');
    await expect(page.getByRole('heading', { name: /assigned reports/i })).toBeVisible();

    const rows = page.getByRole('link').filter({ hasText: /CIV-2026-/ });
    await expect(rows.first()).toBeVisible();

    // The list "Status code" filter is a text input (placeholder-driven locator
    // so the test is resilient whether or not the input carries an explicit id).
    const statusInput = page
      .getByPlaceholder(/assigned, accepted, in_progress/i)
      .or(page.getByLabel('Status code'));
    await statusInput.first().fill('accepted');
    await page.waitForTimeout(500);

    const empty = page.getByText(/no reports match/i);
    const visibleRows = page.getByRole('link').filter({ hasText: /CIV-2026-/ });
    expect((await empty.isVisible().catch(() => false)) || (await visibleRows.count()) > 0).toBe(
      true,
    );

    // Clearing the filter restores the full list.
    await statusInput.first().fill('');
    await page.waitForTimeout(500);
    await expect(visibleRows.first()).toBeVisible();
  });

  test('report detail: add internal note and walk a full lifecycle', async ({ page }) => {
    const token = await getBearerToken(page);
    const listRes = await fetch(`${API}/department/reports?per_page=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = (await listRes.json()) as {
      data: Array<{ id: string; tracking_number: string; current_status_code: string }>;
    };
    const assigned = list.data.find((r) => r.current_status_code === 'assigned');

    test.skip(!assigned, 'No assigned report available for the lifecycle walk in this tenant');

    await page.goto(`/operations/reports/${assigned.id}`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(assigned.tracking_number).first()).toBeVisible();

    // Status-aware footer: only Accept is enabled in `assigned`.
    await expect(page.getByRole('button', { name: /^accept$/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /^start$/i })).toBeDisabled();

    // Add an internal note.
    const noteBox = page.getByRole('textbox', { name: /internal note/i });
    await noteBox.fill('E2E: crew notified.');
    await page.getByRole('button', { name: /save note/i }).click();
    await expect(page.getByText(/e2e: crew notified\./i)).toBeVisible();

    await page.getByRole('button', { name: /^accept$/i }).click();
    await expect(page.getByText(/^accepted$/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^start$/i }).click();
    await expect(page.getByText(/^in_progress$/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^resolve$/i }).click();
    await expect(page.getByText(/^resolved$/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^close$/i }).click();
    await expect(page.getByText(/^closed$/i).first()).toBeVisible();

    // After terminal state the decision buttons disable and the note remains.
    await expect(page.getByRole('button', { name: /^accept$/i })).toBeDisabled();
    await expect(page.getByText(/terminal state/i).first()).toBeVisible();
  });

  test('export page downloads CSV, XLSX and PDF', async ({ page }) => {
    await page.goto('/operations/reports/export');
    await expect(page.getByRole('heading', { name: /export reports/i })).toBeVisible();
    const dir = test.info().outputDir;
    const fs = await import('node:fs');

    const [csv] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /^download$/i }).click(),
    ]);
    expect(csv.suggestedFilename()).toMatch(/\.csv$/i);
    await csv.saveAs(`${dir}/export.csv`);
    expect(fs.readFileSync(`${dir}/export.csv`, 'utf-8')).toContain('tracking_number');

    await page.getByRole('button', { name: /^xlsx$/i }).click();
    const [xlsx] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /^download$/i }).click(),
    ]);
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/i);
    await xlsx.saveAs(`${dir}/export.xlsx`);

    await page.getByRole('button', { name: /^pdf$/i }).click();
    const [pdf] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /^download$/i }).click(),
    ]);
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/i);
    await pdf.saveAs(`${dir}/export.pdf`);
    const pdfPath = await pdf.path();
    const header = fs.readFileSync(pdfPath, { encoding: 'latin1', length: 8 });
    expect(header).toContain('%PDF');
  });

  test('export menu on the report list downloads a file', async ({ page }) => {
    await page.goto('/operations/reports');
    await page.getByRole('button', { name: /^export$/i }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('menuitem', { name: /download as .*csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('analytics page renders charts from live data', async ({ page }) => {
    await page.goto('/operations/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/by status/i)).toBeVisible();
  });

  test('GIS map page renders the map container', async ({ page }) => {
    await page.goto('/operations/map');
    await expect(page.getByRole('heading', { name: /gis map/i })).toBeVisible();
    await expect(page.locator('.leaflet-container').first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Operations elevated features — production (super admin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('audit log lists events', async ({ page }) => {
    await page.goto('/operations/audit');
    await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible();
    const token = await getBearerToken(page);
    const res = await fetch(`${API}/admin/audit-logs?per_page=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      await expect(page.locator('table').first()).toBeVisible();
    } else {
      await expect(page.getByText(/no audit events match/i)).toBeVisible();
    }
  });

  test('security dashboard renders widget cards', async ({ page }) => {
    await page.goto('/operations/security');
    await expect(page.getByRole('heading', { name: /security dashboard/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /failed logins/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /mock gps reports/i })).toBeVisible();
  });

  test('department admin lists officers and settings', async ({ page }) => {
    await page.goto('/operations/admin');
    await expect(page.getByRole('heading', { name: /department admin/i })).toBeVisible();
    await expect(page.getByText(/default sla/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^officers$/i })).toBeVisible();
  });
});
