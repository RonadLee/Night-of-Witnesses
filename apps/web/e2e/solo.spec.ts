import { test, expect } from '@playwright/test';

test('home offers solo and multiplayer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Night of/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Solo Mode' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Multiplayer Mode' })).toBeVisible();
});

test('solo mode can complete a scripted round', async ({ page }) => {
  await page.goto('/solo');
  await page.getByRole('button', { name: 'Start night' }).click();

  // Drive the human through whatever legal actions appear until result.
  for (let step = 0; step < 80; step++) {
    if (await page.getByText(/Witnesses win|Murderer side wins/i).isVisible().catch(() => false)) {
      break;
    }

    const keep = page.getByRole('button', { name: /^Keep / });
    if (await keep.count()) {
      await keep.first().click();
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

    // Ability buttons without skip somehow
    const spy = page.getByRole('button', { name: /peek Guest Room/i });
    if (await spy.isVisible().catch(() => false)) {
      await spy.click();
      continue;
    }

    await page.waitForTimeout(200);
  }

  await expect(page.getByText(/Witnesses win|Murderer side wins/i)).toBeVisible({
    timeout: 15_000,
  });
});
