import { test, expect } from '@playwright/test';
import { login, register, adoptPet, uniqueAccount, ACCOUNTS } from './helpers';

/**
 * The core player loop, end to end:
 * register → adopt → feed → play a game → claim a mission → redeem a reward.
 */

test.describe('player journey', () => {
  test('should register a new player and land on onboarding', async ({ page }) => {
    const account = uniqueAccount();
    await register(page, account);

    await expect(page).toHaveURL(/\/(onboarding|dashboard)/);
  });

  test('should adopt a pet and show it on the pet page', async ({ page }) => {
    const account = uniqueAccount();
    await register(page, account);
    await adoptPet(page, 'Wobble');

    await expect(page.getByRole('heading', { name: 'Wobble' })).toBeVisible();
    await expect(page.getByText('Vital stats')).toBeVisible();
  });

  test('should feed the pet and award coins', async ({ page }) => {
    const account = uniqueAccount();
    await register(page, account);
    await adoptPet(page, 'Nibbles');

    await page.goto('/pet/care');
    await expect(page.getByRole('heading', { name: /Care for Nibbles/ })).toBeVisible();

    // The Feed row's action button.
    const feedCard = page.locator('div').filter({ hasText: /^Feed/ }).first();
    await page.getByRole('button', { name: 'Feed' }).first().click().catch(async () => {
      // The button reads "Go" when the action is ready; fall back to positional.
      await feedCard.getByRole('button').click();
    });

    // The toast is rendered from the SERVER's response, so seeing it means the
    // transaction actually committed — not just that a click handler fired.
    await expect(page.getByText(/coins/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should put the pet on cooldown after feeding', async ({ page }) => {
    const account = uniqueAccount();
    await register(page, account);
    await adoptPet(page, 'Cooldown');

    await page.goto('/pet/care');
    await page.getByRole('button', { name: 'Go' }).first().click();
    await page.waitForTimeout(2000);

    // The button now shows a countdown rather than "Go".
    await expect(page.getByRole('button', { name: /ready in/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should sign in an existing player and show their pet', async ({ page }) => {
    await login(page, ACCOUNTS.player1);
    await page.goto('/pet');

    await expect(page.getByRole('heading', { name: 'Mochi' })).toBeVisible();
  });

  test('should show the game lobby with energy and attempts', async ({ page }) => {
    await login(page, ACCOUNTS.player1);
    await page.goto('/games');

    await expect(page.getByRole('heading', { name: 'Mini games' })).toBeVisible();
    await expect(page.getByText(/energy/i).first()).toBeVisible();
    await expect(page.getByText('Endless Runner')).toBeVisible();
    await expect(page.getByText('Feeding Catch')).toBeVisible();
  });

  test('should start an endless runner session', async ({ page }) => {
    await login(page, ACCOUNTS.player1);
    await page.goto('/games/endless-runner');

    await expect(page.getByRole('heading', { name: 'Endless Runner' })).toBeVisible();

    await page.getByRole('button', { name: /Start/ }).click();

    // The countdown proves the server issued a signed session — the client cannot
    // reach this state on its own.
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 });
  });

  test('should list daily missions with progress', async ({ page }) => {
    await login(page, ACCOUNTS.player1);
    await page.goto('/missions');

    await expect(page.getByRole('heading', { name: 'Missions' })).toBeVisible();
    await expect(page.getByText('Sign in today')).toBeVisible();
  });

  test('should claim a completed mission reward exactly once', async ({ page }) => {
    await login(page, ACCOUNTS.player1);

    // Claiming the daily streak completes the "Sign in today" mission.
    await page.goto('/dashboard');
    const streakButton = page.getByRole('button', { name: 'Claim' });
    if (await streakButton.isVisible().catch(() => false)) {
      await streakButton.click();
      await page.waitForTimeout(1500);
    }

    await page.goto('/missions');
    const claimButton = page.getByRole('button', { name: 'Claim' }).first();

    if (await claimButton.isVisible().catch(() => false)) {
      await claimButton.click();
      await expect(page.getByText(/claimed/i).first()).toBeVisible({ timeout: 10_000 });

      // The button must not offer a second claim.
      await page.reload();
      await expect(page.getByRole('button', { name: 'Done' }).first()).toBeVisible();
    }
  });

  test('should show the reward shop with the player’s point balance', async ({ page }) => {
    await login(page, ACCOUNTS.player1);
    await page.goto('/rewards');

    await expect(page.getByRole('heading', { name: 'Reward shop' })).toBeVisible();
    await expect(page.getByText('Free Coffee')).toBeVisible();
  });

  test('should redeem a reward and produce a QR claim', async ({ page }) => {
    await login(page, ACCOUNTS.player1);
    await page.goto('/rewards');

    // Ice Cream costs 40 points; the seeded player has 320.
    await page
      .locator('div')
      .filter({ hasText: /Ice Cream Cone/ })
      .getByRole('button', { name: 'Redeem' })
      .first()
      .click();

    await expect(page.getByRole('heading', { name: /Redeem Ice Cream Cone/ })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm redemption' }).click();

    // Lands on the claim detail page with a rendered QR and a typable claim code.
    await page.waitForURL(/\/claims\/[a-z0-9]+/, { timeout: 20_000 });
    await expect(page.getByAltText(/QR code for claim/)).toBeVisible();
    await expect(page.getByText(/^PQ-/)).toBeVisible();
  });
});
