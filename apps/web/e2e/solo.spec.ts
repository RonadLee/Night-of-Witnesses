import { test, expect } from '@playwright/test';

test('home offers solo and multiplayer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Night of/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solo Mode' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Multiplayer Mode' })).toBeVisible();
});

test('solo lobby shows AI roster then can complete a round', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/solo?fast=1');
  await expect(page.getByRole('heading', { name: 'Solo Lobby' })).toBeVisible();
  await expect(page.getByText('AI roster')).toBeVisible();
  await page.getByRole('button', { name: 'Start night' }).click();
  await expect(page.getByRole('heading', { name: /Role Assignment|Description Phase/i })).toBeVisible({
    timeout: 10_000,
  });

  for (let step = 0; step < 120; step++) {
    if (await page.getByText(/Witnesses win|Murderer side wins/i).isVisible().catch(() => false)) {
      break;
    }

    const keep = page.getByRole('button', { name: /^Keep / });
    if (await keep.count()) {
      await keep.first().click();
      const confirm = page.getByRole('button', { name: 'Confirm' });
      await expect(confirm).toBeVisible({ timeout: 3_000 });
      await confirm.click();
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

    const voteLabel = page.getByText('Vote to lock in Boiler Room');
    if (await voteLabel.isVisible().catch(() => false)) {
      const voteButtons = voteLabel.locator('..').getByRole('button');
      if (await voteButtons.count()) {
        await voteButtons.first().click();
        continue;
      }
    }

    const spy = page.getByRole('button', { name: /peek Guest Room/i });
    if (await spy.isVisible().catch(() => false)) {
      await spy.click();
      continue;
    }

    await page.waitForTimeout(200);
  }

  await expect(
    page.getByRole('heading', { name: /Witnesses win|Murderer side wins/i }),
  ).toBeVisible({
    timeout: 20_000,
  });
});
