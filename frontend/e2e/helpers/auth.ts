import { type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'demo1234';

export interface DemoAccount {
  label: string;
  mobile: string;
}

export const ACCOUNTS = {
  officer: { label: 'Department Officer', mobile: '9999900003' },
  superAdmin: { label: 'Super Admin', mobile: '9999900004' },
};

/**
 * Logs into the live SPA using the staff password form (no OTP needed
 * for demo staff accounts). Waits until the browser is routed to the
 * expected post-login portal.
 */
export async function loginAsStaff(
  page: Page,
  account: DemoAccount,
  expectedPath: RegExp,
): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: /staff password login/i }).click();
  await page.getByLabel('Mobile number').fill(account.mobile);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(expectedPath, { timeout: 20_000 });
}

/**
 * Reads the bearer token the SPA persisted after login, so tests can
 * call the API the same way the UI does (for content-type / status
 * assertions that the UI does not surface).
 */
export async function getBearerToken(page: Page): Promise<string> {
  return page.evaluate((): string => {
    const raw = window.localStorage.getItem('cip.session.v1');
    if (!raw) return '';
    try {
      return (JSON.parse(raw) as { token?: string }).token ?? '';
    } catch {
      return '';
    }
  });
}
