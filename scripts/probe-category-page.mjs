/**
 * One-off UI inventory for Financials → Category using the same auth as Playwright tests.
 * Run from repo root: node scripts/probe-category-page.mjs
 * Requires: sessionState.json (playwright-generated) and playwright dependency.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const storagePath = path.join(root, 'sessionState.json');

const urls = [
  '/financials/category',
  '/financials/category?propertyId=765',
];

async function main() {
  if (!fs.existsSync(storagePath)) {
    console.error('Missing sessionState.json — run a login test or auth flow first.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: storagePath,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await ctx.newPage();

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(url.includes('propertyId') ? 35_000 : 15_000);

    const pathname = new URL(page.url()).pathname;
    const title = await page.title();

    const testIds = await page.locator('[data-testid]').evaluateAll((els) =>
      [...new Set(els.map((e) => e.getAttribute('data-testid')).filter(Boolean))].sort(),
    );

    const mainButtons = await page.locator('main button').evaluateAll((els) =>
      els
        .map((el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 45),
    );

    const columnHeaders = await page.locator('[role="columnheader"]').evaluateAll((els) =>
      els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 35),
    );

    const breadcrumbs = await page.evaluate(() =>
      [...document.querySelectorAll('main a[href], main button')]
        .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
        .filter((t) => t.length && t.length < 120)
        .slice(0, 25),
    );

    const placeholders = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('input[placeholder]')].map((i) => i.getAttribute('placeholder')))].filter(Boolean),
    );

    console.log(JSON.stringify({
      probeUrl: url,
      landedUrl: page.url(),
      pathname,
      title,
      testIds,
      placeholders,
      columnHeadersUnique: [...new Set(columnHeaders)].slice(0, 30),
      mainButtonSampleUnique: [...new Set(mainButtons)].slice(0, 28),
      breadcrumbTextsSample: [...new Set(breadcrumbs)].slice(0, 15),
    }, null, 2));
    console.log('---');
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
