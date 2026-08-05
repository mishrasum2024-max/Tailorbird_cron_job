/**
 * One-off safety check (not part of the regular suite): confirms
 * SAMPLE_PROPERTY_5 / SAMPLE_PROPERTY_6 hard-coded in
 * TC16_cleanup_properties.spec.js exactly match live Properties grid rows,
 * since TC259's keep-list uses exact string equality and a mismatch would
 * mean these "protected" properties get deleted for real.
 *
 * Run: npx playwright test scripts/verify_protected_property_names.spec.js --headed
 */
require('dotenv').config();
const { test, expect } = require('@playwright/test');
const PropertiesHelper = require('../pages/properties');

test.use({ storageState: 'sessionState.json' });

const EXPECTED = [
  'Test Property5_Reassigning_Automation',
  'Test Property 6_Draw reporting',
];

test('verify protected property names exactly match live grid', async ({ page }) => {
  test.setTimeout(180000);
  const prop = new PropertiesHelper(page);
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://beta.tailorbird.com/financials/capex';

  await prop.goto(dashboardUrl);
  expect(page.url()).not.toContain('/login');

  await prop.goToProperties();
  await prop.changeView('Table View');

  for (const name of EXPECTED) {
    const input = page.locator('input[placeholder="Search..."]').first();
    await input.fill('');
    await page.waitForTimeout(2000);
    await input.fill(name);
    await page.waitForTimeout(3000);

    const grid = page.locator('[role="treegrid"]').first();
    const rows = grid.locator('[role="row"]');
    const count = await rows.count().catch(() => 0);
    const cellTexts = [];
    for (let i = 0; i < count; i++) {
      const firstCell = rows.nth(i).locator('[role="gridcell"]').first();
      if ((await firstCell.count().catch(() => 0)) === 0) continue;
      const raw = (await firstCell.innerText().catch(() => '')).trim().split('\n')[0].trim();
      if (raw) cellTexts.push(raw);
    }
    const exactMatch = cellTexts.some((t) => t === name);
    console.log(`\n>>> Searched: "${name}"`);
    console.log(`>>> Rows found: ${JSON.stringify(cellTexts)}`);
    console.log(`>>> EXACT match present: ${exactMatch}`);
  }
});
