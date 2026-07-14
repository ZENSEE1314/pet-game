import type { Page } from '@playwright/test';

/** Seeded development accounts. Documented in the README. */
export const ACCOUNTS = {
  player1: { email: 'player1@petquest.dev', password: 'Player123!pass' },
  player2: { email: 'player2@petquest.dev', password: 'Player123!pass' },
  staff: { email: 'staff@petquest.dev', password: 'Staff123!pass' },
  admin: { email: 'admin@petquest.dev', password: 'Admin123!pass' },
  superAdmin: { email: 'superadmin@petquest.dev', password: 'SuperAdmin123!' },
} as const;

export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for the app shell rather than a fixed timeout — a sleep here is how a suite
  // becomes flaky on a slow CI box.
  await page.waitForURL(/\/(dashboard|onboarding|staff|admin)/, { timeout: 20_000 });
}

/** A fresh account per run, so tests never fight over one user's cooldowns. */
export function uniqueAccount() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `e2e-${stamp}@petquest.test`,
    password: 'E2ETesting123',
    username: `e2e${stamp}`.slice(0, 20),
    displayName: `E2E ${stamp}`.slice(0, 40),
  };
}

export async function register(page: Page, account: ReturnType<typeof uniqueAccount>) {
  await page.goto('/register');
  await page.getByLabel('Username').fill(account.username);
  await page.getByLabel('Display name').fill(account.displayName);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password').fill(account.password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/(onboarding|dashboard|login)/, { timeout: 25_000 });
}

export async function adoptPet(page: Page, name = 'Pixel') {
  await page.goto('/onboarding');
  await page.getByLabel('Pet name').fill(name);
  await page.getByRole('button', { name: 'Adopt' }).click();
  await page.waitForURL('**/pet', { timeout: 20_000 });
}
