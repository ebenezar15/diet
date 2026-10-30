import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 412, height: 839 }, hasTouch: true, isMobile: true });
await page.goto('http://localhost:4173/');
await page.getByRole('checkbox').check();
await page.getByRole('button', { name: 'Continue' }).click();
for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /Continue/ }).click();
await page.getByRole('button', { name: /Build my plan/ }).click();
await page.getByText("Today's plan").waitFor({ timeout: 15000 });
for (const r of ['today', 'plan', 'recipes', 'shop', 'progress', 'gut', 'fit', 'settings', 'chart']) {
  await page.goto('http://localhost:4173/#/' + r); await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > W + 1 && !e.closest('.overflow-x-auto')).slice(0, 3).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} r=${Math.round(e.getBoundingClientRect().right)}`);
    return { sw: document.documentElement.scrollWidth, W, wide };
  });
  console.log(r, JSON.stringify(info));
}
await browser.close();
