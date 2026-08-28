import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  // Headless textile suite stability: vite must serve on 5173 when CIP_DEV_HTTP=1.
  // The 5180 dev stack (./start.sh default) is intentionally separate; do not
  // change that stack. For headless via webServer, run with:
  //   CIP_DEV_HTTP=1 CIP_BACKEND_PORT=8100 npx playwright test e2e/textile- --project=chromium
  // If you see 404 on `/`, ensure CIP_DEV_HTTP=1 is set and no stale vite
  // occupies 5173 (reuseExistingServer will reuse a correct 5173 server).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CIP_DEV_HTTP: '1',
      CIP_FRONTEND_PORT: '5173',
      CIP_BACKEND_PORT: process.env.CIP_BACKEND_PORT ?? '8100',
      VITE_API_BASE: '/api/v1',
      VITE_API_BASE_URL: '/api/v1',
    },
  },
});
