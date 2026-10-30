import { expect, test } from '@playwright/test';

test('onboarding → plan → shopping list → log meal offline → reload offline → data persists', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome to ThaliFit')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('e.g. Ebenezar').fill('Test User');
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /Continue/ }).click();
    if (i === 2) await page.getByRole('button', { name: /^Keto/ }).click();
  }
  await page.getByRole('button', { name: /Build my plan/ }).click();
  await expect(page.getByText("Today's plan")).toBeVisible({ timeout: 20_000 });

  // Plan: 7 days generated
  await page.getByRole('button', { name: 'Plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sun' })).toBeVisible();

  // Shopping list built with Indian purchase units
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByText('Meat & fish')).toBeVisible();
  await expect(page.getByText(/Est\. total/)).toBeVisible();

  // Wait for the service worker to take control so the shell is cached
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // ---- go offline
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: /^Log$/ }).first().click();
  await page.getByRole('button', { name: 'Quick add' }).click();
  await page.getByPlaceholder('e.g. Office canteen meal').fill('Offline idli test');
  await page.getByLabel('kcal').fill('321');
  await page.getByRole('dialog').getByRole('button', { name: 'Log', exact: true }).click();
  await expect(page.getByText('Offline idli test')).toBeVisible();

  // Reload while offline — served by the service worker, data from IndexedDB
  await page.reload();
  await expect(page.getByText('Offline idli test')).toBeVisible({ timeout: 15_000 });
  await page.goto('/#/recipes');
  await expect(page.getByText(/Indian recipes/)).toBeVisible();

  // The write is queued in the outbox for sync
  const pending = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('thalifit');
        req.onsuccess = () => {
          const tx = req.result.transaction('outbox', 'readonly');
          const c = tx.objectStore('outbox').count();
          c.onsuccess = () => resolve(c.result);
        };
      })
  );
  expect(pending).toBeGreaterThan(0);

  await context.setOffline(false);
});
