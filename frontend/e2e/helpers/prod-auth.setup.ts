import { test as setup, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { DEMO_PASSWORD, type DemoAccount } from './auth';

const SPA = 'https://cip.dgisipl.com';
const AUTH_DIR = 'e2e/.auth';

async function loginAndSave(page: Page, account: DemoAccount, storagePath: string): Promise<void> {
  await page.goto(`${SPA}/login`);
  await page.getByRole('button', { name: /staff password login/i }).click();
  await page.getByLabel('Mobile number').fill(account.mobile);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // Officer -> /operations, super admin -> /admin.
  await page.waitForURL(/\/(operations|admin)/, { timeout: 20_000 });
  await expect(
    page.getByRole('link', { name: /(dashboard|assigned reports)/i }).first(),
  ).toBeVisible();
  mkdirSync(AUTH_DIR, { recursive: true });
  await page.context().storageState({ path: storagePath });
}

setup('authenticate department officer', async ({ page }) => {
  await loginAndSave(
    page,
    { label: 'Department Officer', mobile: '9999900003' },
    `${AUTH_DIR}/officer.json`,
  );
});

setup('authenticate super admin', async ({ page }) => {
  await loginAndSave(
    page,
    { label: 'Super Admin', mobile: '9999900004' },
    `${AUTH_DIR}/superadmin.json`,
  );
});
