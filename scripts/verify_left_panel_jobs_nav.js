/**
 * Live verification: does navigateToJobsViaLeftPanel (TC16_cleanup_properties.spec.js)
 * now correctly reach /jobs after being fixed to call ensureLeftPanelExpanded first?
 * The left nav loads as a collapsed icon rail by default, which broke the old
 * text-based locators used to find "Jobs (Contracts & POs)".
 *
 * Run: node scripts/verify_left_panel_jobs_nav.js
 */
require('dotenv').config();
const { chromium, expect } = require('@playwright/test');
const path = require('path');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');

const SESSION_STATE = path.join(__dirname, '..', 'sessionState.json');
const START_URL = process.env.DASHBOARD_URL || 'https://beta.tailorbird.com/properties';

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// Same logic as the fixed navigateToJobsViaLeftPanel in TC16_cleanup_properties.spec.js
async function navigateToJobsViaLeftPanel(page) {
    await ensureLeftPanelExpanded(page);

    const nav = page.locator('nav').first();
    await nav.waitFor({ state: 'visible', timeout: 15000 });

    const jobsItem = nav.locator('a, div').filter({ hasText: /^Jobs \(Contracts & POs\)$/i }).first();

    if (!(await jobsItem.isVisible().catch(() => false))) {
        const cmSection = nav.locator('a, div').filter({ hasText: /^Construction Management$/i }).first();
        if (await cmSection.isVisible().catch(() => false)) {
            await cmSection.click();
            await page.waitForTimeout(700);
        }
    }

    await expect(jobsItem).toBeVisible({ timeout: 15000 });
    await jobsItem.click();
    await page.waitForURL('**/jobs', { timeout: 20000 });
    await page.waitForTimeout(3000);
}

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext({ storageState: SESSION_STATE });
    const page = await context.newPage();

    try {
        console.log(`=== Navigating to ${START_URL} (nav should load COLLAPSED) ===`);
        await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(6000);

        if ((page.url() || '').includes('/login')) {
            console.log('SESSION EXPIRED.');
            await browser.close();
            process.exit(1);
        }

        const navbar = page.locator('.mantine-AppShell-navbar').first();
        const widthBefore = await navbar.evaluate((el) => el.getBoundingClientRect().width).catch(() => null);
        console.log(`>>> Navbar width BEFORE fix runs: ${widthBefore}px (collapsed rail is ~68px)`);

        console.log('\n=== Running fixed navigateToJobsViaLeftPanel(page) ===');
        await navigateToJobsViaLeftPanel(page);

        console.log(`>>> URL after navigation: ${page.url()}`);
        const landedOnJobs = /\/jobs(\?|$)/.test(page.url());
        console.log(`>>> Landed on /jobs: ${landedOnJobs}`);

        const widthAfter = await navbar.evaluate((el) => el.getBoundingClientRect().width).catch(() => null);
        console.log(`>>> Navbar width AFTER fix runs (should stay pinned open): ${widthAfter}px`);

        console.log(`\n=== RESULT: ${landedOnJobs ? 'PASS' : 'FAIL'} ===`);
    } catch (err) {
        console.error('\nScript error:', err.message);
        await page.screenshot({ path: path.join(__dirname, 'verify_left_panel_error.png') }).catch(() => {});
    } finally {
        await sleep(1000);
        await browser.close();
        console.log('Browser closed.');
    }
})();
