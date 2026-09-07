import { expect, test, type Page } from '@playwright/test';
import { installCitizenSession } from './helpers/citizen-session';

test.describe('textile pickup minimum', () => {
  test.beforeEach(async ({ page }) => {
    await installCitizenSession(page);

    await page.route('**/api/v1/textile-collection/zones/*/capacity-minimum', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            service_zone_id: 'zone-1',
            min_bags: 2,
            min_weight_kg: 4,
            guidance_text: 'Home pickup requires at least 2 bags or 4 kg.',
          },
        }),
      });
    });

    await page.route('**/api/v1/textile-collection/zones**', async (route) => {
      if (route.request().url().includes('/capacity-minimum')) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'zone-1',
              code: 'DRL-Z1',
              name: 'South Zone',
              center: null,
              service_radius_km: 5,
              methods: ['premises', 'dropoff'],
              dropoff: { name: 'South Centre', address: '100 South Street' },
              dropoff_name: 'South Centre',
              dropoff_address: '100 South Street',
              dropoff_hours: '09:00-17:00',
              readiness_instructions: 'Leave bags at the gate.',
              partner: { id: 'partner-1', name: 'Dr. Linen' },
            },
          ],
        }),
      });
    });

    await page.route('**/api/v1/textile-collection/availability**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
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

  async function fillRequiredFields(page: Page): Promise<void> {
    await page.getByLabel('Request title').fill('Wardrobe cleanout request');
    await page.getByLabel('Full name').fill('E2E Citizen');
    await page.getByLabel('Contact email').fill('e2e@example.com');
    await page.getByLabel('Contact phone').fill('9999900001');
    await page.getByLabel(/Pickup address/).fill('123 Test Street, Bengaluru, Karnataka 560001');
  }

  test('blocks a one-bag, one-kilogram home pickup without an exception option', async ({
    page,
  }) => {
    await page.goto('/citizen/textile-collections/new');
    await fillRequiredFields(page);
    await page.getByLabel('No. of bags').fill('1');
    await page.getByLabel('Approximate weight (kg)').fill('1');

    await expect(page.getByText(/Below the pickup minimum/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pickup minimum not met' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /exception|urgent|short note/i })).toHaveCount(0);
  });

  test('allows home pickup when either two bags or four kilograms is met', async ({ page }) => {
    await page.goto('/citizen/textile-collections/new');
    await fillRequiredFields(page);
    await page.getByLabel('No. of bags').fill('2');
    await page.getByLabel('Approximate weight (kg)').fill('1');

    await expect(page.getByText(/Your estimate meets the guidance/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send pickup request' })).toBeEnabled();
  });
});
