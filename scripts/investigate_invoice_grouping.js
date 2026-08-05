/**
 * Follow-up investigation: is job 3861's invoice grid empty because the job
 * genuinely has no invoiceable line items, or because the invoice form defaults
 * to "Group by Unit" while this job's budget/contract is organized by Scope?
 *
 * This time we do NOT confirm the invoice — we only inspect the grid in both
 * grouping modes and leave it as an untouched Draft.
 *
 * Run: node scripts/investigate_invoice_grouping.js
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

    const treeResponses = [];
    page.on('response', async (res) => {
        const url = res.url();
        if (!/unit-interior-tree|scope-tree|invoices\/\d+\/tree/i.test(url)) return;
        let body = '';
        try {
            body = await res.text();
        } catch {
            // non-fatal
        }
        treeResponses.push({ url, status: res.status(), body });
        console.log(`[TREE-RESPONSE] ${res.status()} ${url}`);
        console.log(`[TREE-BODY] ${body.slice(0, 1000)}`);
    });

    try {
        console.log(`=== Navigating to ${TARGET_URL} ===`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(8000);

        if ((page.url() || '').includes('/login')) {
            console.log('SESSION EXPIRED.');
            await browser.close();
            process.exit(1);
        }

        const invoicePage = new InvoicePage(page);

        console.log('\n=== clickAddInvoice ===');
        await invoicePage.clickAddInvoice();
        await sleep(3000);

        console.log('\n=== Checking for Group-by segmented control ===');
        const ctrl = page.locator('.mantine-SegmentedControl-root');
        const ctrlVisible = await ctrl.isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`>>> SegmentedControl visible: ${ctrlVisible}`);
        if (ctrlVisible) {
            const labels = await ctrl.locator('label').allTextContents().catch(() => []);
            console.log(`>>> SegmentedControl labels: ${JSON.stringify(labels)}`);
        }

        // Inspect grid rows/columns as currently rendered (default grouping)
        const describeGrid = async (tag) => {
            const grid = page.locator('[role="treegrid"]').first();
            const gridVisible = await grid.isVisible({ timeout: 8000 }).catch(() => false);
            if (!gridVisible) {
                console.log(`>>> [${tag}] No treegrid visible.`);
                return;
            }
            const headers = await grid.locator('[role="columnheader"]').allTextContents().catch(() => []);
            const rows = grid.locator('[role="row"][data-rgrow]');
            const rowCount = await rows.count().catch(() => 0);
            console.log(`>>> [${tag}] Grid headers: ${JSON.stringify(headers)}`);
            console.log(`>>> [${tag}] Data row count: ${rowCount}`);
            for (let i = 0; i < Math.min(rowCount, 8); i++) {
                const cells = await rows.nth(i).locator('[role="gridcell"]').allTextContents().catch(() => []);
                console.log(`>>> [${tag}] Row ${i}: ${JSON.stringify(cells)}`);
            }
        };

        console.log('\n=== Grid in DEFAULT grouping ===');
        await describeGrid('default');

        console.log('\n=== Switching to Group by Unit ===');
        await invoicePage.selectInvoiceGroupByTab('unit');
        await sleep(2500);
        await describeGrid('unit');

        console.log('\n=== Switching to Group by Scope ===');
        await invoicePage.selectInvoiceGroupByTab('scope');
        await sleep(2500);
        await describeGrid('scope');

        // Also directly query the contract/bid tables for job 3861 to see if any
        // budget line items with nonzero contract values actually exist.
        console.log('\n=== Directly querying job 3861 contract/bid row data (not just column metadata) ===');
        const contractResp = await page.request.get('https://beta.tailorbird.com/api/bird-table?table_name=ui-contract&jobId=3861&job_id=3861&fetchRows=true').catch(() => null);
        if (contractResp) {
            console.log(`ui-contract fetchRows status: ${contractResp.status()}`);
            const text = await contractResp.text().catch(() => '');
            console.log(`ui-contract body (first 1500 chars): ${text.slice(0, 1500)}`);
        }

        console.log('\n=== Leaving invoice as untouched Draft (Go Back, no confirm) ===');
        await invoicePage.goBackToInvoiceList();
        await sleep(2000);

        console.log('\nDone.');
    } catch (err) {
        console.error('\nScript error:', err.message);
        await page.screenshot({ path: path.join(__dirname, 'investigate_grouping_error.png') }).catch(() => {});
    } finally {
        await sleep(1500);
        await browser.close();
        console.log('Browser closed.');
    }
})();
