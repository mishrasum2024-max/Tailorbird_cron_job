module.exports = async (page) => {
  const fs = require('fs');
  const path = require('path');
  const storagePath = path.resolve(__dirname, '..', 'sessionState.json');
  if (!fs.existsSync(storagePath)) {
    return { ok: false, error: 'sessionState.json not found; run TC01 login test first.' };
  }
  const browser = page.context().browser();
  if (!browser) {
    return { ok: false, error: 'no browser on page context' };
  }
  const ctx = await browser.newContext({
    storageState: storagePath,
    viewport: { width: 1920, height: 1080 },
  });
  const p = await ctx.newPage();
  await p.goto('/financials/category', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await p.waitForTimeout(12000);
  const url = p.url();
  const title = await p.title();
  const authenticated = !/sign in/i.test(title) && !/authkit/i.test(url);
  const testIds = await p.locator('[data-testid]').evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute('data-testid')))].sort(),
  );
  const cols = await p
    .locator('[role="columnheader"]')
    .evaluateAll((els) =>
      els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
    );

  await ctx.close();
  return {
    ok: authenticated && url.includes('/financials/category'),
    url,
    title,
    authenticated,
    testIds,
    columnHeaders: [...new Set(cols)].slice(0, 25),
  };
};
