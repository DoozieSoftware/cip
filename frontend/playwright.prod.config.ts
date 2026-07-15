import { defineConfig, devices } from '@playwright/test';

/**
 * Production end-to-end config.
 *
 * Unlike the default `playwright.config.ts` (which boots the Vite dev
 * server and mocks APIs), this points Playwright at the live SPA and
 * exercises the real backend. Use it to verify the deployed operations
 * portal — every feature, against production data.
 *
 * It authenticates each demo account ONCE in a setup project and reuses
 * the saved session (storageState) for every test, so the 9 sequential
 * tests don't trip the production login rate-limiter.
 *
 *   npx playwright test --config playwright.prod.config.ts
 *
 * Runs Chromium headless against https://cip.dgisipl.com. The demo
 * staff accounts (password `demo1234`) log in for real, so this
 * performs genuine reads and state transitions on the demo tenant.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'https://cip.dgisipl.com',
    headless: true,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /helpers\/prod-auth\.setup\.ts/,
    },
    {
      name: 'officer',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/officer.json',
      },
    },
    {
      name: 'super-admin',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/superadmin.json',
      },
    },
  ],
});
