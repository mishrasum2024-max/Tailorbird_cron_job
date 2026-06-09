/**
 * Standalone Playwright script to inspect the real Brooke property CapEx grid.
 * Run: node scripts/inspect_brooke_capex.js
 * Outputs: scripts/brooke_capex_data.json
 */
require('dotenv').config();
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PROPERTY_SEARCH = 'the brook';
const SESSION_STATE = path.join(__dirname, '..', 'sessionState.json');
const CAPEX_URL = process.env.DASHBOARD_URL || '/financials/capex';
const OUTPUT_FILE = path.join(__dirname, 'brooke_capex_data.json');

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 200 });
    const context = await browser.newContext({ storageState: SESSION_STATE });
    const page = await context.newPage();

    try {
        console.log('=== Step 1: Navigate to CapEx page ===');
        await page.goto(CAPEX_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);
        console.log('URL:', page.url());

        // ── Step 2: Click the property dropdown ──
        console.log('\n=== Step 2: Click property dropdown ===');
        // The button text is "Select a Property" or contains the current property name
        const propDropdown = page.getByRole('button', { name: /Select a Property|name_|Sample Property|Harbor|Brook|the brook/i }).first();
        const dropdownVisible = await propDropdown.isVisible({ timeout: 5000 }).catch(() => false);

        if (!dropdownVisible) {
            console.log('Property dropdown button not found with primary selector, trying fallback...');
            // Fallback: any button with "Select" text
            const fallback = page.locator('button').filter({ hasText: /Select a Property|Property/i }).first();
            await fallback.click({ timeout: 5000 });
        } else {
            await propDropdown.click();
        }
        await sleep(1500);
        await page.screenshot({ path: path.join(__dirname, 'step2_dropdown_open.png') });
        console.log('Screenshot: step2_dropdown_open.png');

        // ── Step 3: Type "Brooke" in the property search input ──
        console.log('\n=== Step 3: Search for Brooke ===');
        const searchInput = page.getByRole('textbox', { name: /Search properties\.\.\./i }).first();
        const searchVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

        if (searchVisible) {
            await searchInput.fill(PROPERTY_SEARCH);
            console.log(`Typed "${PROPERTY_SEARCH}" in property search`);
        } else {
            // Try any visible textbox that appeared after dropdown click
            const anyInput = page.locator('input[type="text"]:not([readonly])').first();
            if (await anyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await anyInput.fill(PROPERTY_SEARCH);
                console.log('Typed in fallback input');
            } else {
                console.log('WARNING: No search input found');
            }
        }
        await sleep(3000);
        await page.screenshot({ path: path.join(__dirname, 'step3_search_typed.png') });
        console.log('Screenshot: step3_search_typed.png');

        // ── Step 4: Click the Brooke menu item ──
        console.log('\n=== Step 4: Select Brooke from results ===');
        let propertyId = null;

        // Intercept API calls to capture propertyId from response
        const apiCallPromise = page.waitForResponse(
            resp => /\/api\/(bird-table|properties|capex)/.test(resp.url()) && resp.status() === 200,
            { timeout: 15000 }
        ).catch(() => null);

        const brookeOption = page.getByRole('menuitem').filter({ hasText: /the brook/i }).first();
        const optionVisible = await brookeOption.isVisible({ timeout: 5000 }).catch(() => false);

        if (optionVisible) {
            const optionText = await brookeOption.textContent().catch(() => '');
            console.log(`Found option: "${optionText.trim()}"`);
            await brookeOption.click();
            console.log('Clicked Brooke option');
        } else {
            console.log('Brooke option not visible. Checking what IS visible in menu...');
            const allMenuItems = await page.getByRole('menuitem').allTextContents().catch(() => []);
            console.log('Available menu items:', allMenuItems.slice(0, 10));

            // Try without exact match
            const anyItem = page.locator('[role="menuitem"], li[class*="option"], div[class*="option"]').filter({ hasText: /Brooke/i }).first();
            if (await anyItem.isVisible({ timeout: 3000 }).catch(() => false)) {
                await anyItem.click();
                console.log('Clicked Brooke via alternate selector');
            } else {
                console.log('ERROR: Could not find Brooke property option');
                await page.screenshot({ path: path.join(__dirname, 'step4_no_brooke.png') });
                // Exit early and just inspect current state
            }
        }

        await sleep(4000);

        // ── Step 5: Get propertyId from URL ──
        const currentUrl = page.url();
        console.log('\nURL after selection:', currentUrl);
        const urlMatch = currentUrl.match(/propertyId=(\d+)/);
        if (urlMatch) {
            propertyId = parseInt(urlMatch[1]);
            console.log(`✅ PropertyId from URL: ${propertyId}`);
        }

        // Also check if there's an intercepted API call with the property ID
        const capturedResponse = await apiCallPromise;
        if (capturedResponse) {
            console.log('Intercepted API:', capturedResponse.url());
        }

        await page.screenshot({ path: path.join(__dirname, 'step5_after_selection.png') });
        console.log('Screenshot: step5_after_selection.png');

        // ── Step 6: Wait for grid to load ──
        console.log('\n=== Step 6: Waiting for grid to load ===');
        await page.waitForFunction(() => {
            const cells = Array.from(document.querySelectorAll('[role="gridcell"]'));
            return cells.some(c => /\$\d/.test((c.textContent || '').trim()));
        }, { timeout: 25000 }).catch(() => {
            console.log('WARNING: No monetary cells found within 25s');
        });
        await sleep(2000);
        await page.screenshot({ path: path.join(__dirname, 'step6_grid_loaded.png'), fullPage: false });
        console.log('Screenshot: step6_grid_loaded.png');

        // ── Step 7: Extract all grid data ──
        console.log('\n=== Step 7: Extracting grid data ===');
        const gridData = await page.evaluate(() => {
            const clean = (value) => {
                const text = String(value || '').trim();
                if (!text) return '';
                if (!text.includes(':root') && !text.includes('@media')) return text;
                const parts = text.split('}}');
                return (parts[parts.length - 1] || text).trim();
            };

            const gridRoot = document.querySelector('[role="treegrid"]') || document;
            const allHeaderEls = Array.from(gridRoot.querySelectorAll('[role="columnheader"]'));
            const headers = allHeaderEls.map(h => clean(h.textContent || ''));

            const allRowEls = Array.from(gridRoot.querySelectorAll('[role="row"]'));
            const rows = allRowEls.map(rowEl => {
                const cells = Array.from(rowEl.querySelectorAll('[role="gridcell"]'))
                    .map(c => clean(c.textContent || ''));
                return {
                    ariaLevel: rowEl.getAttribute('aria-level'),
                    ariaExpanded: rowEl.getAttribute('aria-expanded'),
                    dataRgRow: rowEl.getAttribute('data-rgrow'),
                    cells
                };
            }).filter(r => r.cells.length > 0);

            // Tree rows with aria-level
            const treeRows = allRowEls
                .filter(r => r.getAttribute('aria-level') !== null)
                .map(rowEl => ({
                    level: parseInt(rowEl.getAttribute('aria-level') || '0'),
                    expanded: rowEl.getAttribute('aria-expanded'),
                    cells: Array.from(rowEl.querySelectorAll('[role="gridcell"]'))
                        .map(c => clean(c.textContent || ''))
                }));

            // Map rows using headers
            const targetHeaders = [
                'Budget Category', 'Category', 'Original Budget', 'Budget Revision',
                'Current Budget', 'Budget Remaining', 'Original Contract Amount',
                'Approved Change Orders', 'Current Contract Amount', 'Remaining Contract Amount',
                'Invoiced Amount'
            ];
            const indexByHeader = {};
            const hasLeadingBlank = headers.length > 0 && headers[0] === '';
            targetHeaders.forEach(h => {
                indexByHeader[h] = headers.findIndex(v => v === h);
            });

            const mappedRows = rows
                .map(r => {
                    const shift = (hasLeadingBlank && r.cells.length === headers.length - 1) ? -1 : 0;
                    const row = { _level: r.ariaLevel, _expanded: r.ariaExpanded };
                    targetHeaders.forEach(h => {
                        const idx = indexByHeader[h];
                        const eff = idx + shift;
                        row[h] = (eff >= 0 && eff < r.cells.length) ? r.cells[eff] : '';
                    });
                    return row;
                })
                .filter(r => (r['Budget Category'] || '').trim());

            // Deduplicate
            const seen = new Set();
            const uniqueRows = mappedRows.filter(r => {
                const k = JSON.stringify(r);
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });

            return {
                headers,
                totalRawRows: rows.length,
                treeRows,
                mappedRows: uniqueRows,
                pageUrl: window.location.href
            };
        });

        // ── Step 8: Print summary ──
        console.log('\n=== RESULTS ===');
        console.log('URL:', gridData.pageUrl);
        console.log('Headers:', gridData.headers.join(' | '));
        console.log('Total raw rows:', gridData.totalRawRows);
        console.log('Mapped rows (deduplicated):', gridData.mappedRows.length);
        console.log('Tree-level rows:', gridData.treeRows.length);

        console.log('\n--- Tree rows with aria-level ---');
        gridData.treeRows.forEach(r => {
            console.log(`  level=${r.level} expanded=${r.expanded}:`, r.cells.slice(0, 3).join(' | '));
        });

        console.log('\n--- First 10 mapped rows ---');
        gridData.mappedRows.slice(0, 10).forEach((r, i) => {
            console.log(`Row ${i} [level=${r._level}]:`,
                `BudgetCat="${r['Budget Category']}"`,
                `Category="${r['Category']}"`,
                `OrigBudget="${r['Original Budget']}"`,
                `BudgetRevision="${r['Budget Revision']}"`,
                `CurrBudget="${r['Current Budget']}"`,
                `BudgetRemaining="${r['Budget Remaining']}"`
            );
        });

        // Check for non-zero values
        const parseMoney = v => {
            const t = String(v || '').trim();
            if (!t || t === '—' || t === '-') return NaN;
            const n = t.replace(/[$,()\s]/g, '').replace(/^-/, '');
            return Number(n);
        };

        const nonZeroCols = ['Original Budget', 'Budget Revision', 'Current Budget', 'Budget Remaining',
            'Approved Change Orders', 'Current Contract Amount', 'Remaining Contract Amount'];
        console.log('\n--- Non-zero column analysis ---');
        nonZeroCols.forEach(col => {
            const nonZeroRows = gridData.mappedRows.filter(r => {
                const v = parseMoney(r[col]);
                return !isNaN(v) && Math.abs(v) > 0;
            });
            console.log(`  ${col}: ${nonZeroRows.length}/${gridData.mappedRows.length} non-zero`);
        });

        // Check for tree hierarchy
        const level1Rows = gridData.treeRows.filter(r => r.level === 1);
        const level2Rows = gridData.treeRows.filter(r => r.level === 2);
        console.log(`\n--- Tree hierarchy ---`);
        console.log(`  Level 1 (Project) rows: ${level1Rows.length}`);
        console.log(`  Level 2 (Job) rows: ${level2Rows.length}`);

        // Check for category codes
        const catCodeRows = gridData.mappedRows.filter(r =>
            (r['Category'] || '').trim() && (r['Category'] || '') !== '—'
        );
        console.log(`  Rows with Category set: ${catCodeRows.length}`);

        // Build output
        const output = {
            timestamp: new Date().toISOString(),
            propertyId,
            gridData
        };
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        console.log(`\n✅ Full data written to: ${OUTPUT_FILE}`);

    } catch (err) {
        console.error('\nScript error:', err.message);
        await page.screenshot({ path: path.join(__dirname, 'error.png') }).catch(() => {});
    } finally {
        await sleep(2000);
        await browser.close();
        console.log('Browser closed.');
    }
})();
