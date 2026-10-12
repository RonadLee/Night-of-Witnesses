import { test, expect } from '@playwright/test';

const WIN_HEADING = /Guest side wins|Murderer side wins|Bomber wins alone|No winner/i;

test('home offers solo and multiplayer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Night of/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solo Mode' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Multiplayer Mode' })).toBeVisible();
});

test('solo uses shared lobby/table and can complete a round', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/solo?fast=1');
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await expect(page.getByText('Solo', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Start match' }).click();
  await expect(page.getByRole('heading', { name: /Card Passing|Description Phase/i })).toBeVisible({
    timeout: 10_000,
  });

  for (let step = 0; step < 120; step++) {
    if (await page.getByRole('heading', { name: WIN_HEADING }).isVisible().catch(() => false)) {
      break;
    }

    const passCard = page.getByRole('button', { name: /Pass this card/i });
    if (await passCard.count()) {
      await passCard.first().click();
      const chain = page.getByRole('button', { name: /Pass to .* \(chain\)/i });
      if (await chain.isVisible().catch(() => false)) {
        await chain.click();
      }
      const confirm = page.getByRole('button', { name: 'Confirm' });
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click();
      }
      continue;
    }

    if (await page.getByRole('button', { name: 'Announce sighting' }).isVisible()) {
      await page.getByRole('button', { name: 'Announce sighting' }).click();
      continue;
    }

    if (await page.getByRole('button', { name: 'Skip ability' }).isVisible()) {
      await page.getByRole('button', { name: 'Skip ability' }).click();
      continue;
    }

    if (await page.getByRole('button', { name: /End discussion/i }).isVisible()) {
      await page.getByRole('button', { name: /End discussion/i }).click();
      continue;
    }

    if (
      await page
        .getByText(/Click any seat to vote them into the Private Room/i)
        .isVisible()
        .catch(() => false)
    ) {
      const seats = page.locator('.circular-seat');
      if (await seats.count()) {
        await seats.nth(1).click();
        continue;
      }
    }

    await page.waitForTimeout(200);
  }

  await expect(page.getByRole('heading', { name: WIN_HEADING })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Private Room/i).first()).toBeVisible();
});
