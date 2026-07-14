import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against a real server, a real Postgres and a real Redis. Mocking any of
 * them would test the mocks — and the flows that matter most here (score validation,
 * QR single-use, stock reservation) are all defended in the database.
 *
 * Prerequisites:  docker compose up -d  &&  npm run db:migrate  &&  npm run db:seed
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // the suite shares seeded accounts and finite reward stock
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 45_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
