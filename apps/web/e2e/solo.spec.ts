import { test, expect } from '@playwright/test';

const WIN_HEADING =
  /Guest side wins|Murderer side wins|Bomber wins alone|No winner|客人陣營獲勝|殺人魔陣營獲勝|炸彈客獨自獲勝|無人獲勝/i;

test('home offers solo, multiplayer, and library', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Night of|見證之夜/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Solo Mode|單人模式/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Multiplayer Mode|多人模式/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Game Library|遊戲圖鑑/i }).first()).toBeVisible();
});

test('game library opens and language switches', async ({ page }) => {
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: /Game Library|遊戲圖鑑/i })).toBeVisible();
  await page.getByRole('radio', { name: /繁體中文/i }).first().click();
  await expect(page.getByRole('heading', { name: '遊戲圖鑑' })).toBeVisible();
  await page.getByPlaceholder(/搜尋|Search/i).fill('殺人魔');
  await expect(page.getByText('殺人魔').first()).toBeVisible();
  await page.getByRole('radio', { name: /English/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Game Library' })).toBeVisible();
});

test('solo uses shared lobby/table and can complete a round', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/solo?fast=1');
  await expect(page.getByRole('heading', { name: /Lobby|大廳/i })).toBeVisible();
  await page.getByRole('button', { name: /Start match|開始對局/i }).click();
  await expect(
    page.getByRole('heading', { name: /Card Passing|Description Phase|傳牌階段|描述階段/i }),
  ).toBeVisible({
    timeout: 10_000,
  });

  for (let step = 0; step < 120; step++) {
    if (await page.getByRole('heading', { name: WIN_HEADING }).isVisible().catch(() => false)) {
      break;
    }

    const passCard = page.getByRole('button', { name: /Pass this card|傳出此牌/i });
    if (await passCard.count()) {
      await passCard.first().click();
      const chain = page.getByRole('button', { name: /Pass to .*|傳給/i });
      if (await chain.isVisible().catch(() => false)) {
        await chain.click();
      }
      const confirm = page.getByRole('button', { name: /Confirm Pass|確認傳牌|Confirm/i });
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click();
      }
      continue;
    }

    if (await page.getByRole('button', { name: /Announce sighting|宣布目擊/i }).isVisible()) {
      await page.getByRole('button', { name: /Announce sighting|宣布目擊/i }).click();
      continue;
    }

    if (await page.getByRole('button', { name: /Skip ability|跳過技能/i }).isVisible()) {
      await page.getByRole('button', { name: /Skip ability|跳過技能/i }).click();
      continue;
    }

    if (await page.getByRole('button', { name: /End discussion|結束討論/i }).isVisible()) {
      await page.getByRole('button', { name: /End discussion|結束討論/i }).click();
      continue;
    }

    if (
      await page
        .getByText(/Click any seat to vote|點選座位/i)
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
