import type { Page } from '@playwright/test';

export const TEST_CITIZEN_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Install a stable citizen session before the SPA boots. These browser tests
 * exercise authenticated portal behavior while intercepting only the API calls
 * relevant to the journey under test.
 */
export async function installCitizenSession(page: Page): Promise<void> {
  await page.addInitScript(
    ({ citizenId }) => {
      window.localStorage.setItem(
        'cip.session.v1',
        JSON.stringify({
          token: 'citizen-e2e-token',
          user: {
            id: citizenId,
            name: 'E2E Citizen',
            mobile: '9999900001',
            roles: ['citizen'],
          },
        }),
      );
    },
    { citizenId: TEST_CITIZEN_ID },
  );
}
