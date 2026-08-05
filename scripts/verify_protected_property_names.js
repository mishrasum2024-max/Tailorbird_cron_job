/**
 * Safety check before running TC259 (which deletes every property NOT in an
 * exact-match keep-list): confirm SAMPLE_PROPERTY_5 and SAMPLE_PROPERTY_6
 * strings hard-coded in TC16_cleanup_properties.spec.js exactly match what's
 * actually rendered in the live Properties grid.
 *
 * Run: node scripts/verify_protected_property_names.js
 */
require('dotenv').config();
const { chromium } = require('@playwright/test');
const path = require('path');
const PropertiesHelper = require('../pages/properties');

const SESSION_STATE = path.join(__dirname, '..', 'sessionState.json');
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://beta.tailorbird.com/financials/capex';

const EXPECTED = [
    'Test Property5_Reassigning_Automation',
    'Test Property 6_Draw reporting',
];

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 80 });
    const context = await browser.newContext({ storageState: SESSION_STATE });
    const page = await context.newPage();
    const prop = new PropertiesHelper(page);

    try {
        await prop.goto(DASHBOARD_URL);
        if ((page.url() || '').includes('/login')) {
            console.log('SESSION EXPIRED.');
            await browser.close();
            process.exit(1);
        }
        await prop.goToProperties();
        await prop.changeView('Table View');

        for (const name of EXPECTED) {
            const input = page.locator('input[placeholder="Search..."]').first();
            await input.fill('');
            await sleep(2000);
            await input.fill(name);
            await sleep(3000);

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
            if (!exactMatch && cellTexts.length > 0) {
                console.log(`>>> MISMATCH WARNING: closest candidate(s) shown above differ from hardcoded string byte-for-byte.`);
            }
            if (cellTexts.length === 0) {
                console.log(`>>> NOT FOUND AT ALL — this property may not exist in the current environment.`);
            }
        }
    } catch (err) {
        console.error('\nScript error:', err.message);
    } finally {
        await sleep(1000);
        await browser.close();
        console.log('\nBrowser closed.');
    }
})();
