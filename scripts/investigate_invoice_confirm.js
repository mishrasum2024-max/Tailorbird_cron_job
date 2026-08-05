/**
 * Standalone Playwright script to investigate why TC262 (invoice creation loop)
 * can report success while the invoice never actually appears in the app.
 * Drives the exact same InvoicePage methods TC262 uses, while logging:
 *   - every invoice/bird-table network request+response (status + body)
 *   - the Confirm Invoice button's visible/enabled state right before clicking
 *   - fillInvoiceGridAmount's real return value
 *   - whether the created invoice is actually findable in the list afterward
 *
 * Run: node scripts/investigate_invoice_confirm.js
 * Requires a valid sessionState.json at repo root (same one the test suite uses).
 */
require('dotenv').config();
const { chromium } = require('@playwright/test');
const path = require('path');
const { InvoicePage } = require('../pages/invoicePage');

const SESSION_STATE = path.join(__dirname, '..', 'sessionState.json');
const TARGET_URL = process.env.INVOICE_TARGET_URL || 'https://beta.tailorbird.com/jobs/3861?propertyId=6009&tab=invoices';

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 150 });
    const context = await browser.newContext({ storageState: SESSION_STATE });
    const page = await context.newPage();

    const networkLog = [];
    page.on('response', async (res) => {
        const url = res.url();
        if (!/invoice|bird-table/i.test(url)) return;
        let bodySnippet = '';
        try {
            const ct = res.headers()['content-type'] || '';
            if (ct.includes('json')) {
                bodySnippet = (await res.text()).slice(0, 800);
            }
        } catch {
            // response body may already be consumed/unavailable — non-fatal for logging
        }
        const entry = { method: res.request().method(), url, status: res.status(), body: bodySnippet };
        networkLog.push(entry);
        console.log(`[NET] ${entry.method} ${entry.status} ${url}`);
        if (bodySnippet) console.log(`[NET BODY] ${bodySnippet}`);
    });

    try {
        console.log(`=== Navigating to ${TARGET_URL} ===`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(8000);
        console.log('URL after navigation:', page.url());

        if ((page.url() || '').includes('/login')) {
            console.log('SESSION EXPIRED — sessionState.json is not authenticated. Refresh it and rerun.');
            await browser.close();
            process.exit(1);
        }

        const invoicePage = new InvoicePage(page);
        const stamp = Date.now();
        const invoiceNumber = `INVESTIGATE-${stamp}`;
        const invoiceTitle = `Investigation Invoice ${stamp}`;

        console.log('\n=== clickAddInvoice ===');
        await invoicePage.clickAddInvoice();
        await sleep(2000);

        console.log('\n=== fillInvoiceDetails ===');
        await invoicePage.fillInvoiceDetails({ title: invoiceTitle, description: 'Investigation run — safe to delete', invoiceNumber });

        console.log('\n=== fillInvoiceGridAmount(100) ===');
        const amountFilled = await invoicePage.fillInvoiceGridAmount(100);
        console.log(`>>> fillInvoiceGridAmount returned: ${amountFilled}`);

        console.log('\n=== Confirm Invoice button state BEFORE click ===');
        const confirmBtn = page.getByRole('button', { name: /confirm invoice/i });
        const btnVisible = await confirmBtn.isVisible().catch(() => false);
        const btnEnabled = btnVisible ? await confirmBtn.isEnabled().catch(() => false) : false;
        console.log(`>>> Confirm Invoice button — visible: ${btnVisible}, enabled: ${btnEnabled}`);

        console.log('\n=== confirmInvoiceAndHandleModal ===');
        let confirmResult;
        let confirmError = null;
        try {
            confirmResult = await invoicePage.confirmInvoiceAndHandleModal();
        } catch (err) {
            confirmError = err.message;
        }
        console.log(`>>> confirmInvoiceAndHandleModal result: ${confirmResult}, error: ${confirmError}`);

        await sleep(2000);
        console.log('\n=== goBackToInvoiceList ===');
        await invoicePage.goBackToInvoiceList();
        await sleep(2000);

        console.log('\n=== Verifying invoice actually exists in the list ===');
        const searchInput = page.locator('input[placeholder="Search..."]').first();
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await searchInput.fill(invoiceTitle);
            await sleep(3000);
        }
        const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
        const foundByTitle = bodyText.includes(invoiceTitle);
        const foundByNumber = bodyText.includes(invoiceNumber);
        console.log(`>>> Found by title ("${invoiceTitle}"): ${foundByTitle}`);
        console.log(`>>> Found by number ("${invoiceNumber}"): ${foundByNumber}`);

        console.log('\n=== SUMMARY ===');
        console.log(JSON.stringify({
            amountFilled,
            confirmButtonVisible: btnVisible,
            confirmButtonEnabled: btnEnabled,
            confirmResult,
            confirmError,
            foundByTitle,
            foundByNumber,
            relevantNetworkCalls: networkLog,
        }, null, 2));
    } catch (err) {
        console.error('\nScript error:', err.message);
        await page.screenshot({ path: path.join(__dirname, 'investigate_invoice_error.png') }).catch(() => {});
    } finally {
        await sleep(1500);
        await browser.close();
        console.log('Browser closed.');
    }
})();
