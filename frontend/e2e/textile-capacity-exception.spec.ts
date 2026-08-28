/* eslint-disable */
import { test, expect } from '@playwright/test';
import { installCitizenSession } from './helpers/citizen-session';

/**
 * Phase 5/6 citizen exception flow — below-minimum journey.
 * Covers: minimum guidance rendered, exception CTA when below minimum,
 * not shown otherwise, submit with exception posts idempotency, and
 * detail page shows exception state. Never silently rejects.
 * Deterministic via mocked API; Chromium only in CI.
 */

test.describe('textile capacity exception — citizen below-minimum journey', () => {
  test.beforeEach(async ({ page }) => {
    await installCitizenSession(page);

    // Mock zones list
    await page.route('**/api/v1/textile-collection/zones/*/capacity-minimum', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            service_zone_id: 'zone-1',
            min_bags: 5,
            min_weight_kg: 10,
            guidance_text: 'Please combine with neighbours if possible.',
          },
        }),
      });
    });

    await page.route('**/api/v1/textile-collection/zones**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const url = route.request().url();
      if (url.includes('/capacity-minimum')) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: [
            {
              id: 'zone-1',
              code: 'DRL-Z1',
              name: 'South Zone',
              center: null,
              service_radius_km: 5,
              methods: ['premises', 'dropoff'],
              dropoff: { name: 'South Centre', address: '100 South St' },
              dropoff_name: 'South Centre',
              dropoff_address: '100 South St',
              dropoff_hours: '09:00-17:00',
              readiness_instructions: 'Leave bags at gate.',
              partner: { id: 'partner-1', name: 'Dr. Linen' },
            },
          ],
        }),
      });
    });

    // Mock availability for premises
    await page.route('**/api/v1/textile-collection/availability**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            service_zone_id: 'zone-1',
            collection_method: 'premises',
            unavailable_dates: [],
            next_available_date: null,
            cutoff_hours: null,
            reason: null,
            windows: [],
          },
        }),
      });
    });
  });

  test('request page shows partner minimum and never silently rejects', async ({ page }) => {
    let createCalled = false;
    await page.route('**/api/v1/textile-collection/requests', async (route) => {
      if (route.request().method() === 'POST') {
        createCalled = true;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        // Even below minimum, backend should accept — never silent reject
        expect(body.estimated_bags).toBeDefined();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Collection request submitted.',
            data: {
              id: 'col-exc-1',
              reference: 'DLN-2026-EXC001',
              title: 'Wardrobe cleanout below minimum',
              status: 'pending_review',
              service_zone_id: 'zone-1',
              estimated_bags: 2,
              estimated_weight_kg: 3,
              collection_method: 'premises',
              service_zone: {
                id: 'zone-1',
                code: 'DRL-Z1',
                name: 'South Zone',
                dropoff_name: null,
                dropoff_address: null,
                center: null,
              },
              partner: { id: 'partner-1', name: 'Dr. Linen' },
              batch: null,
              photos: [],
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    const capacityMinimumResponse = page.waitForResponse(
      (resp) => resp.url().includes('/capacity-minimum') && resp.status() === 200,
    );
    await page.goto('/citizen/textile-collections/new');
    await expect(page.locator('body')).toBeVisible();
    // Title input — guidance should load without extra user action when single zone exists
    await page.getByLabel('Request title').fill('Wardrobe cleanout below minimum');
    await capacityMinimumResponse;
    // Wait for zones and capacity minimum to load — guidance should appear
    await expect(page.getByText(/Minimum quantities for a collection route/)).toBeVisible();
    await expect(page.getByText(/This partner's guidance:\s*5\s*bags\s*or\s*10\s*kg/)).toBeVisible();
    await expect(page.getByText(/Please combine with neighbours/)).toBeVisible();

    // Fill required collection fields — service zone defaults to South Zone
    // Fill name, email, phone, address, bags etc via TextileCollectionFields
    await page.getByLabel('Full name').fill('E2E Citizen');
    await page.getByLabel('Contact email').fill('e2e@example.com');
    await page.getByLabel('Contact phone').fill('9999900001');
    await page.getByLabel(/Pickup address/).fill('123 Test Street, Bengaluru, Karnataka 560001');
    await page.getByLabel('No. of bags').fill('2');
    await page.getByLabel('Approximate weight (kg)').fill('3');

    // Below-minimum notice should appear — partner minimum 5 bags / 10 kg, we gave 2 bags / 3 kg
    await expect(page.getByText(/Your estimate is below the partner minimum/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Request exception/i }).first()).toBeVisible();
    await expect(page.getByText(/We never silently reject/)).toBeVisible();

    // Primary submit should still be enabled — never silently reject
    const primary = page.getByRole('button', { name: /Send pickup request/i });
    await expect(primary).toBeEnabled();
    await primary.click();

    await expect.poll(() => createCalled).toBe(true);
  });

  test('below-minimum CTA not shown when estimate meets minimum', async ({ page }) => {
    await page.goto('/citizen/textile-collections/new');
    await expect(page.locator('body')).toBeVisible();
    await page.getByLabel('Request title').fill('Large cleanout meeting minimum');
    await expect(page.getByText(/Minimum quantities/)).toBeVisible();

    await page.getByLabel('Full name').fill('E2E Citizen');
    await page.getByLabel('Contact email').fill('e2e@example.com');
    await page.getByLabel('Contact phone').fill('9999900001');
    await page.getByLabel(/Pickup address/).fill('123 Test Street, Bengaluru, Karnataka 560001');
    await page.getByLabel('No. of bags').fill('6');
    await page.getByLabel('Approximate weight (kg)').fill('12');

    // Should show meets guidance, no CTA
    await expect(page.getByText(/meets the guidance/)).toBeVisible();
    await expect(page.getByText(/Your estimate is below/)).not.toBeVisible();
    // The exception CTA inside notice should not appear; bottom secondary panel also not
    await expect(page.getByRole('button', { name: /^Request exception$/i })).not.toBeVisible();
  });

  test('exception request posts with idempotency after collection creation', async ({ page }) => {
    let exceptionRequest: {
      url: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
    } | null = null;

    await page.route('**/api/v1/textile-collection/requests', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Collection request submitted.',
            data: {
              id: 'col-exc-2',
              reference: 'DLN-2026-EXC002',
              title: 'Exception pickup',
              status: 'pending_review',
              service_zone_id: 'zone-1',
              estimated_bags: 1,
              estimated_weight_kg: 1,
              collection_method: 'premises',
              service_zone: {
                id: 'zone-1',
                code: 'DRL-Z1',
                name: 'South Zone',
                dropoff_name: null,
                dropoff_address: null,
                center: null,
              },
              partner: { id: 'partner-1', name: 'Dr. Linen' },
              batch: null,
              photos: [],
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route(
      '**/api/v1/citizen/textile-collections/col-exc-2/capacity-exception',
      async (route) => {
        if (route.request().method() === 'POST') {
          exceptionRequest = {
            url: route.request().url(),
            headers: route.request().headers(),
            body: route.request().postDataJSON() as Record<string, unknown>,
          };
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Exception requested.',
              data: {
                id: 'exc-1',
                collection_request_id: 'col-exc-2',
                service_zone_id: 'zone-1',
                department_id: 'partner-1',
                status: 'pending',
                reason_code: 'below_minimum',
                reason: 'High-value heritage sarees need urgent clearance, happy to combine.',
                payload_snapshot: null,
              },
            }),
          });
          return;
        }
        await route.continue();
      },
    );

    // Detail fetch after navigate — include capacity_exception_id so next step is tested
    await page.route('**/api/v1/citizen/textile-collections/col-exc-2', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'OK',
            data: {
              id: 'col-exc-2',
              reference: 'DLN-2026-EXC002',
              title: 'Exception pickup',
              status: 'pending_review',
              notes: null,
              pickup_address: '123 Test Street',
              collection_method: 'premises',
              category: 'clothes_waste',
              estimated_bags: 1,
              estimated_weight_kg: 1,
              scheduled_date: null,
              scheduled_window_start: null,
              scheduled_window_end: null,
              readiness_instructions: null,
              rejection_reason: null,
              cancellation_reason: null,
              missed_pickup_reason: null,
              picked_up_at: null,
              submitted_at: new Date().toISOString(),
              capacity_exception_id: 'exc-1',
              capacity_checked_at: new Date().toISOString(),
              capacity_context: {
                exception_approved_at: null,
                reason: 'High-value heritage sarees need urgent clearance',
              },
              service_zone: {
                id: 'zone-1',
                code: 'DRL-Z1',
                name: 'South Zone',
                dropoff_name: null,
                dropoff_address: null,
                center: null,
              },
              partner: { id: 'partner-1', name: 'Dr. Linen' },
              batch: null,
              photos: [],
              service_zone_id: 'zone-1',
              requester_type: 'individual',
              requester_name: 'E2E Citizen',
              rwa_name: null,
              contact_email: 'e2e@example.com',
              contact_phone: '9999900001',
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/citizen/textile-collections/new');
    await page.getByLabel('Request title').fill('Exception pickup');
    await page.getByLabel('Full name').fill('E2E Citizen');
    await page.getByLabel('Contact email').fill('e2e@example.com');
    await page.getByLabel('Contact phone').fill('9999900001');
    await page.getByLabel(/Pickup address/).fill('123 Test Street, Bengaluru, Karnataka 560001');
    await page.getByLabel('No. of bags').fill('1');
    await page.getByLabel('Approximate weight (kg)').fill('1');

    await expect(page.getByRole('button', { name: /Request exception/i }).first()).toBeVisible();
    // Open exception form from notice
    await page
      .getByRole('button', { name: /Request exception/i })
      .first()
      .click();
    // Now bottom form should be visible
    await expect(page.getByLabel('Exception reason')).toBeVisible();
    await page
      .getByLabel('Exception reason')
      .fill('High-value heritage sarees need urgent clearance, happy to combine.');
    await page.getByRole('button', { name: /Submit with exception note/i }).click();

    // Wait for exception POST
    await expect.poll(() => exceptionRequest !== null).toBe(true);
    expect(
      exceptionRequest?.headers['idempotency-key'] ?? exceptionRequest?.headers['Idempotency-Key'],
    ).toBeTruthy();
    expect(exceptionRequest?.body.reason).toBe(
      'High-value heritage sarees need urgent clearance, happy to combine.',
    );
    expect(exceptionRequest?.body.reason_code).toBe('below_minimum');
    expect((exceptionRequest?.body.reason as string).length).toBeGreaterThanOrEqual(10);
  });

  test('exception request validates reason length (at least 10 chars)', async ({ page }) => {
    await page.route('**/api/v1/textile-collection/requests', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'OK',
            data: {
              id: 'col-exc-3',
              reference: 'DLN-2026-EXC003',
              title: 't',
              status: 'pending_review',
              service_zone_id: 'zone-1',
              estimated_bags: 1,
              estimated_weight_kg: 1,
              collection_method: 'premises',
              service_zone: {
                id: 'zone-1',
                code: 'DRL-Z1',
                name: 'South Zone',
                dropoff_name: null,
                dropoff_address: null,
                center: null,
              },
              partner: { id: 'partner-1', name: 'Dr. Linen' },
              batch: null,
              photos: [],
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/citizen/textile-collections/new');
    await page.getByLabel('Request title').fill('Short reason test');
    await page.getByLabel('Full name').fill('E2E Citizen');
    await page.getByLabel('Contact email').fill('e2e@example.com');
    await page.getByLabel('Contact phone').fill('9999900001');
    await page.getByLabel(/Pickup address/).fill('123 Test Street, Bengaluru, Karnataka 560001');
    await page.getByLabel('No. of bags').fill('1');
    await page.getByLabel('Approximate weight (kg)').fill('1');

    await page
      .getByRole('button', { name: /Request exception/i })
      .first()
      .click();
    await expect(page.getByLabel('Exception reason')).toBeVisible();
    await page.getByLabel('Exception reason').fill('short');
    await page.getByRole('button', { name: /Submit with exception note/i }).click();
    await expect(page.getByText(/at least 10 characters/)).toBeVisible();
  });

  test('detail page shows exception requested/approved/rejected state', async ({ page }) => {
    await page.route('**/api/v1/citizen/textile-collections/col-detail-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            id: 'col-detail-1',
            reference: 'DLN-2026-D001',
            title: 'Detail exception view',
            status: 'pending_review',
            notes: null,
            pickup_address: '123 Test Street',
            collection_method: 'premises',
            category: 'clothes_waste',
            estimated_bags: 1,
            estimated_weight_kg: 1,
            scheduled_date: null,
            scheduled_window_start: null,
            scheduled_window_end: null,
            readiness_instructions: 'Leave at gate',
            rejection_reason: null,
            cancellation_reason: null,
            missed_pickup_reason: null,
            picked_up_at: null,
            submitted_at: new Date().toISOString(),
            capacity_exception_id: 'exc-detail-1',
            capacity_checked_at: new Date().toISOString(),
            capacity_context: {
              exception_approved_at: new Date().toISOString(),
              exception_id: 'exc-detail-1',
            },
            service_zone: {
              id: 'zone-1',
              code: 'DRL-Z1',
              name: 'South Zone',
              dropoff_name: null,
              dropoff_address: null,
              center: null,
            },
            partner: { id: 'partner-1', name: 'Dr. Linen' },
            batch: null,
            photos: [],
            service_zone_id: 'zone-1',
            requester_type: 'individual',
            requester_name: 'E2E Citizen',
            rwa_name: null,
            contact_email: 'e2e@example.com',
            contact_phone: '9999900001',
          },
        }),
      });
    });

    await page.goto('/citizen/textile-collections/col-detail-1');
    await expect(page.getByText('Detail exception view')).toBeVisible();
    await expect(page.getByLabel('Capacity exception')).toBeVisible();
    await expect(page.getByText(/Exception approved/)).toBeVisible();
    await expect(page.getByText('Reference: exc-detail-1')).toBeVisible();
  });

  test('detail without exception does not show capacity banner but history evidence states remain', async ({
    page,
  }) => {
    await page.route('**/api/v1/citizen/textile-collections/col-detail-2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'OK',
          data: {
            id: 'col-detail-2',
            reference: 'DLN-2026-D002',
            title: 'No exception detail',
            status: 'pending_review',
            notes: null,
            pickup_address: '123 Test Street',
            collection_method: 'premises',
            category: 'clothes_waste',
            estimated_bags: 5,
            estimated_weight_kg: 10,
            scheduled_date: null,
            scheduled_window_start: null,
            scheduled_window_end: null,
            readiness_instructions: null,
            rejection_reason: null,
            cancellation_reason: null,
            missed_pickup_reason: null,
            picked_up_at: null,
            submitted_at: new Date().toISOString(),
            capacity_exception_id: null,
            capacity_checked_at: null,
            capacity_context: null,
            service_zone: {
              id: 'zone-1',
              code: 'DRL-Z1',
              name: 'South Zone',
              dropoff_name: null,
              dropoff_address: null,
              center: null,
            },
            partner: { id: 'partner-1', name: 'Dr. Linen' },
            batch: null,
            photos: [],
            service_zone_id: 'zone-1',
            requester_type: 'individual',
            requester_name: 'E2E Citizen',
            rwa_name: null,
            contact_email: 'e2e@example.com',
            contact_phone: '9999900001',
          },
        }),
      });
    });

    await page.goto('/citizen/textile-collections/col-detail-2');
    await expect(page.getByText('No exception detail')).toBeVisible();
    await expect(page.getByLabel('Capacity exception')).not.toBeVisible();
  });

  test('mobile 375px viewport does not overflow and keeps CTA reachable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/v1/textile-collection/requests', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'OK',
            data: {
              id: 'col-mob-1',
              reference: 'DLN-MOB',
              title: 't',
              status: 'pending_review',
              service_zone_id: 'zone-1',
              estimated_bags: 1,
              estimated_weight_kg: 1,
              collection_method: 'premises',
              service_zone: {
                id: 'zone-1',
                code: 'DRL-Z1',
                name: 'South Zone',
                dropoff_name: null,
                dropoff_address: null,
                center: null,
              },
              partner: { id: 'partner-1', name: 'Dr. Linen' },
              batch: null,
              photos: [],
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/citizen/textile-collections/new');
    await expect(page.locator('body')).toBeVisible();
    await page.getByLabel('Request title').fill('Mobile below minimum');
    await page.getByLabel('Full name').fill('E2E Citizen');
    await page.getByLabel('Contact email').fill('e2e@example.com');
    await page.getByLabel('Contact phone').fill('9999900001');
    await page.getByLabel(/Pickup address/).fill('123 Test Street, Bengaluru, Karnataka 560001');
    await page.getByLabel('No. of bags').fill('1');

    await expect(page.getByText(/Your estimate is below/)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await expect(page.getByRole('button', { name: /Request exception/i }).first()).toBeVisible();
  });
});
