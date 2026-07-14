import { test, expect } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

/**
 * The operator side: staff collecting a claim by code, and an admin adjusting a
 * balance with a mandatory reason.
 */

test.describe('staff', () => {
  test('should reach the scanner page', async ({ page }) => {
    await login(page, ACCOUNTS.staff);
    await page.goto('/staff');

    await expect(page.getByRole('heading', { name: 'Reward scanner' })).toBeVisible();
    await expect(page.getByPlaceholder('PQ-A7K2-9XQF')).toBeVisible();
  });

  test('should collect a reward using a manually typed claim code', async ({ page, browser }) => {
    // A player redeems a reward and we capture the claim code…
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();

    await login(playerPage, ACCOUNTS.player1);
    await playerPage.goto('/rewards');
    await playerPage
      .locator('div')
      .filter({ hasText: /Free Coffee/ })
      .getByRole('button', { name: 'Redeem' })
      .first()
      .click();
    await playerPage.getByRole('button', { name: 'Confirm redemption' }).click();
    await playerPage.waitForURL(/\/claims\/[a-z0-9]+/, { timeout: 20_000 });

    const claimCode = await playerPage.locator('p.font-mono').first().innerText();
    expect(claimCode).toMatch(/^PQ-/);

    await playerContext.close();

    // …and staff collects it by typing that code.
    await login(page, ACCOUNTS.staff);
    await page.goto('/staff');

    await page.getByPlaceholder('PQ-A7K2-9XQF').fill(claimCode);
    await page.getByRole('button', { name: 'Look up' }).click();

    await expect(page.getByText('Valid claim')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Free Coffee')).toBeVisible();

    await page.getByRole('button', { name: 'Confirm collection' }).click();
    await expect(page.getByText(/Collection confirmed/i)).toBeVisible({ timeout: 15_000 });

    // The single-use guard: the same code must not collect a second time.
    await page.getByPlaceholder('PQ-A7K2-9XQF').fill(claimCode);
    await page.getByRole('button', { name: 'Look up' }).click();

    await expect(page.getByText('Cannot collect')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/already collected/i)).toBeVisible();
  });

  test('should show collection history', async ({ page }) => {
    await login(page, ACCOUNTS.staff);
    await page.goto('/staff/history');

    await expect(page.getByRole('heading', { name: 'Collection history' })).toBeVisible();
  });

  test('should keep staff out of the admin area', async ({ page }) => {
    await login(page, ACCOUNTS.staff);
    await page.goto('/admin');

    // Middleware bounces them; the admin API would refuse them independently.
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('admin', () => {
  test('should show the dashboard with economy figures', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Total users')).toBeVisible();
    await expect(page.getByText('Economy')).toBeVisible();
  });

  test('should refuse a balance adjustment without a reason', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/admin/users');

    await page.getByRole('button', { name: /Adjust balance for player1/ }).click();
    await expect(page.getByRole('heading', { name: 'Adjust balance' })).toBeVisible();

    await page.getByLabel('Amount').fill('100');

    // No reason typed — the confirm button must stay disabled. The API enforces the
    // same rule, so a hand-crafted request gets a 422 rather than an unexplained
    // ledger entry.
    await expect(page.getByRole('button', { name: /^Credit/ })).toBeDisabled();
  });

  test('should adjust a balance when a reason is given', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/admin/users');

    await page.getByRole('button', { name: /Adjust balance for player2/ }).click();
    await page.getByLabel('Amount').fill('250');
    await page.getByLabel('Reason (required)').fill('E2E test adjustment — compensating a bug');

    await page.getByRole('button', { name: /^Credit/ }).click();

    await expect(page.getByText(/Balance adjusted/i)).toBeVisible({ timeout: 15_000 });
  });

  test('should record the adjustment in the audit log', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/admin/audit');

    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await expect(page.getByText('BALANCE ADJUSTED').first()).toBeVisible();
  });

  test('should show the ledger as read-only', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/admin/transactions');

    await expect(page.getByRole('heading', { name: 'Transaction ledger' })).toBeVisible();
    await expect(page.getByText(/Append-only/)).toBeVisible();
  });

  test('should expose the game configuration levers', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/admin/games');

    await expect(page.getByRole('heading', { name: 'Game configuration' })).toBeVisible();
    await expect(page.getByText('Anti-cheat thresholds').first()).toBeVisible();
    await expect(page.getByLabel('Max score per second').first()).toBeVisible();
  });

  test('should keep a player out of the admin area', async ({ page }) => {
    await login(page, ACCOUNTS.player1);
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
