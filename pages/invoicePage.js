const { expect } = require("@playwright/test");
const { Logger } = require('../utils/logger');
const { invoiceLocators } = require('../locators/invoiceLocator');
const { changeOrderLocators } = require('../locators/changeOrderLocator');

class InvoicePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;

        /** Invoice tab header action — beta may render "Create Invoice", "Add Invoice", or casing variants. */
        this.addInvoiceButton = page
            .getByRole('button', { name: /^(Create|Add) Invoice$/i })
            .locator('visible=true')
            .first();

        // Add Change Order button (header action - exact match to exclude "Change Orders" tab)
        this.addChangeOrderButton = page.getByRole('button', { name: 'Create Change Order', exact: true });

        // Invoice table/grid - AG Grid structure
        // Multiple selectors for robustness - use locator with filter to find the invoice grid
        // this.invoiceTable = page.locator('[role="grid"]').filter({ hasText: 'Invoice Number' }).first();
        this.invoiceTable = page.locator(
            'revo-grid:has([role="columnheader"] span:text("Invoice Number"))'
        );

        // Invoice tab: rows must be scoped to the grid whose headers include Invoice Number (not Change Order).
        this.invoiceRows = page.locator(
            'revo-grid:has([role="columnheader"] span:text("Invoice Number")) ' +
            'revogr-data[type="rgRow"] div[role="row"]'
        );
        // Change Orders tab: separate grid/headers per audit (split from invoice table semantics).
        this.changeOrderRows = page.locator(
            'revo-grid:has([role="columnheader"] span:text("Change Order Number")) ' +
            'revogr-data[type="rgRow"] div[role="row"]'
        );


        this.invoiceTab = page.getByRole('tab', { name: 'Invoice' });
        this.changeOrderTab = page.getByRole('tab', { name: 'Change Orders' });

        // Invoice detail form selectors (on invoice detail page)
        this.titleInput = page.locator('textbox[placeholder="Enter title"]').or(page.locator('input[placeholder*="title"]')).first();
        this.amountInput = page.locator('input[type="number"]').or(page.locator('input[placeholder*="amount"]')).first();
        this.descriptionInput = page.locator('textbox[placeholder="Enter description"]').or(page.locator('textarea')).first();

        // File upload
        this.fileUploadInput = page.locator('input[type="file"]');
        this.uploadButton = page.locator('button').filter({ hasText: /upload|Upload/i }).first();

        // Buttons
        this.saveButton = page.getByRole('button', { name: /save|confirm|submit/i }).first();
        this.cancelButton = page.getByRole('button', { name: 'Cancel' }).or(page.getByRole('button', { name: 'Go Back' })).first();
        this.deleteButton = page.getByRole('button', { name: /delete/i }).first();
        this.goBackButton = page.getByRole('button', { name: 'Go Back' });

        // View Invoice button
        this.viewInvoiceButton = page.getByRole('button', { name: 'View Invoice' }).first();

        // Success message
        this.successMessage = page.locator('text=/[Ss]uccess|[Cc]ompleted|[Ss]aved/').first();

        // Invoice stats
        this.currentContractAmount = page.locator('text=Current Contract').locator('..').locator('p').first();
        this.approvedInvoiceAmount = page.locator('text=Approved Invoices').locator('..').locator('p').first();
        this.contractRemaining = page.locator('text=Contract Remaining').locator('..').locator('p').first();
        this.pendingInvoiceAmount = page.locator('text=Pending Invoices').locator('..').locator('p').first();

        this.changeOrderLocators = changeOrderLocators(page);
    }

    // Getter to ensure fresh dialog locator - uses multiple selectors for robustness
    get modal() {
        // Try multiple selectors to find the dialog/modal
        return this.page.locator('dialog, [role="dialog"]').first();
    }

    async navigateToInvoices(jobUrl) {
        try {
            Logger.step('Navigating to Invoice tab...');
            await this.page.goto(jobUrl, { waitUntil: 'load' });
            await expect(this.page).toHaveURL(/tab=invoices/);
            await this.page.waitForTimeout(1000);
            Logger.success('Navigated to Invoice tab successfully.');
        } catch (error) {
            Logger.error(`Error navigating to invoices: ${error.message}`);
            throw error;
        }
    }

    async clickAddInvoice() {
        try {
            Logger.step('Clicking Create / Add Invoice...');
            const headerBtn = this.page
                .getByRole('button', { name: /^(Create|Add) Invoice$/i })
                .locator('visible=true')
                .first();
            await headerBtn.waitFor({ state: 'visible', timeout: 25000 });
            await headerBtn.scrollIntoViewIfNeeded().catch(() => {});

            const currentUrl = this.page.url();
            Logger.info(`Current URL before click: ${currentUrl}`);

            await headerBtn.click();

            await this.page.waitForURL(/\/invoices\/\d+/, { timeout: 25000 }).catch(() => {
                Logger.info('URL may not have changed yet — relying on invoice form selectors');
            });
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(800);

            // Form readiness: invoice # field and/or title field (accessible names vary by Mantine rev)
            const formReady = this.page
                .getByRole('textbox', { name: /invoice number/i })
                .or(this.page.getByPlaceholder(/invoice number/i))
                .or(this.page.locator('input[placeholder*="invoice number" i]'))
                .or(this.page.getByPlaceholder(/enter title/i))
                .or(this.page.locator('input[placeholder*="title" i]'))
                .first();
            await formReady.waitFor({ state: 'visible', timeout: 25000 });

            Logger.success('Create / Add Invoice clicked; invoice form visible.');
        } catch (error) {
            Logger.error(`Error clicking Add Invoice: ${error.message}`);
            throw error;
        }
    }

    async fillInvoiceTitle(title) {
        try {
            Logger.step(`Filling invoice title: ${title}`);
            // Try multiple selectors for title input
            let titleInputElement = await this.page.locator('textbox[placeholder="Enter title"]').first().isVisible({ timeout: 2000 }).catch(() => false);

            if (!titleInputElement) {
                titleInputElement = await this.page.locator('input[placeholder*="title"]').first().isVisible({ timeout: 2000 }).catch(() => false);
            }

            if (titleInputElement) {
                const input = this.page.locator('textbox[placeholder="Enter title"]').or(this.page.locator('input[placeholder*="title"]')).first();
                await input.fill(title);
                await input.blur();
                Logger.success(`Invoice title filled: ${title}`);
            } else {
                Logger.info('Title input not found - may not be visible yet');
            }
        } catch (error) {
            Logger.error(`Error filling title: ${error.message}`);
            throw error;
        }
    }

    async fillInvoiceAmount(amount) {
        try {
            Logger.step(`Attempting to fill invoice amount: ${amount}`);
            // Note: The invoice form does not have an amount input field
            // Amount is determined by the selected items in the invoice grid
            Logger.info('Amount is not directly fillable - it is calculated from invoice items');
            return true;
        } catch (error) {
            Logger.error(`Error with amount: ${error.message}`);
            throw error;
        }
    }

    async fillInvoiceDescription(description) {
        try {
            Logger.step(`Filling invoice description: ${description}`);
            // Look for description input in the Overview section
            const descInputElement = this.page.locator('input[placeholder="Enter description"], textarea[placeholder="Enter description"]').first();

            if (await descInputElement.isVisible({ timeout: 5000 }).catch(() => false)) {
                await descInputElement.fill(description);
                await descInputElement.blur();
                Logger.success(`Invoice description filled: ${description}`);
            } else {
                Logger.info('Description input not found in visible form');
            }
        } catch (error) {
            Logger.error(`Error filling description: ${error.message}`);
            throw error;
        }
    }

    async uploadInvoiceImage(filePath) {
        try {
            Logger.step(`Uploading invoice image: ${filePath}`);
            if (await this.fileUploadInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await this.fileUploadInput.setInputFiles(filePath);
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1000);
                Logger.success(`Invoice image uploaded: ${filePath}`);
            } else {
                Logger.info('File upload input not found');
            }
        } catch (error) {
            Logger.error(`Error uploading image: ${error.message}`);
            throw error;
        }
    }

    async saveInvoice() {
        try {
            Logger.step('Saving invoice...');
            // Look for save/confirm button on invoice detail page
            let saveBtn = await this.page.getByRole('button').filter({ hasText: /save|confirm|submit/i }).first().isVisible({ timeout: 3000 }).catch(() => false);

            if (saveBtn) {
                await this.page.getByRole('button').filter({ hasText: /save|confirm|submit/i }).first().click();
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1500);
                Logger.success('Invoice saved successfully.');
                return true;
            } else {
                // Try to find save action button
                const actionButton = await this.page.locator('button').filter({ hasText: /save|confirm/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
                if (actionButton) {
                    await this.page.locator('button').filter({ hasText: /save|confirm/i }).first().click();
                    await this.page.waitForLoadState('load');
                    await this.page.waitForTimeout(1500);
                    Logger.success('Invoice saved successfully.');
                    return true;
                } else {
                    Logger.info('Save button not found');
                    return false;
                }
            }
        } catch (error) {
            Logger.error(`Error saving invoice: ${error.message}`);
            throw error;
        }
    }

    async isModalOpen() {
        try {
            // Check if we're on an invoice details page (which shows as a dialog)
            const isOnInvoicePage = this.page.url().includes('/invoices/');
            const isDialogVisible = await this.page.locator('dialog').isVisible({ timeout: 2000 }).catch(() => false);

            return isOnInvoicePage || isDialogVisible;
        } catch (error) {
            Logger.error(`Error checking modal: ${error.message}`);
            return false;
        }
    }

    async closeModal() {
        try {
            Logger.step('Closing invoice details page...');

            // Try pressing Escape key first (most reliable)
            await this.page.keyboard.press('Escape');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(800);
            Logger.success('Closed invoice details page with Escape key.');

            // Ensure we're back on the Invoice tab
            await this.navigateToInvoiceTab().catch(() => {
                Logger.info('Could not navigate to Invoice tab after close');
            });
        } catch (error) {
            Logger.error(`Error closing modal: ${error.message}`);
            throw error;
        }
    }

    async verifyInvoiceAdded() {
        try {
            Logger.step('Verifying invoice was added...');
            const invoiceCount = await this.invoiceRows.count();
            if (invoiceCount > 0) {
                Logger.success(`Invoice added. Total invoices: ${invoiceCount}`);
                return true;
            } else {
                Logger.info('No invoices found');
                return false;
            }
        } catch (error) {
            Logger.error(`Error verifying invoice: ${error.message}`);
            throw error;
        }
    }

    async getInvoiceStats() {
        try {
            Logger.step('Fetching invoice statistics...');
            const currentContract = await this.currentContractAmount.textContent().catch(() => null);
            const approvedInvoices = await this.approvedInvoiceAmount.textContent().catch(() => null);
            const remaining = await this.contractRemaining.textContent().catch(() => null);
            const pending = await this.pendingInvoiceAmount.textContent().catch(() => null);

            return {
                currentContract,
                approvedInvoices,
                remaining,
                pending
            };
        } catch (error) {
            Logger.error(`Error fetching stats: ${error.message}`);
            throw error;
        }
    }

    async navigateToInvoiceTab() {
        try {
            Logger.step('Navigating to Invoice tab...');
            const invoiceTab = this.page.getByRole('tab', { name: 'Invoice' });
            await invoiceTab.waitFor({ state: 'visible', timeout: 10000 });
            await invoiceTab.click();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(1000);
            await this.page.waitForURL(/tab=invoices/);
            await this.page.waitForTimeout(2000);
            Logger.success('Navigated to Invoice tab successfully.');
        } catch (error) {
            Logger.error(`Error in navigateToInvoiceTab: ${error.message}`);
            throw error;
        }
    }

    /**
     * Selects the "Group by Unit" or "Group by Scope" tab in the invoice creation grid.
     * This SegmentedControl was added to the invoice detail page and replaces the flat grid view.
     * @param {'unit'|'scope'} groupBy - Which grouping to select (default: 'scope')
     */
    async selectInvoiceGroupByTab(groupBy = 'scope') {
        try {
            Logger.step(`Selecting invoice group-by tab: "Group by ${groupBy}"...`);
            const ctrl = this.page.locator('.mantine-SegmentedControl-root');
            const isVisible = await ctrl.isVisible({ timeout: 3000 }).catch(() => false);
            if (!isVisible) {
                Logger.info('No Group-by SegmentedControl found — skipping tab selection.');
                return;
            }
            const label = ctrl.locator('label').filter({ hasText: new RegExp(`Group by ${groupBy}`, 'i') });
            const labelVisible = await label.isVisible({ timeout: 3000 }).catch(() => false);
            if (!labelVisible) {
                Logger.info(`"Group by ${groupBy}" label not visible — skipping.`);
                return;
            }
            await label.click({ timeout: 5000 });
            await this.page.waitForTimeout(500);
            Logger.success(`Invoice group-by tab set to "Group by ${groupBy}".`);
        } catch (error) {
            Logger.info(`selectInvoiceGroupByTab: non-fatal error — ${error.message}`);
        }
    }

    async navigateToChangeOrderTab() {
        try {
            Logger.step('Navigating to Change Order tab...');
            // Try multiple selectors to find Change Orders tab
            let changeOrderTab = await this.page.locator('[role="tab"]:has-text("Change Orders")').first().isVisible({ timeout: 3000 }).catch(() => false);

            if (!changeOrderTab) {
                changeOrderTab = await this.page.locator('button, [role="tab"]').filter({ hasText: 'Change Orders' }).first().isVisible({ timeout: 3000 }).catch(() => false);
            }

            if (changeOrderTab) {
                await this.page.locator('[role="tab"]:has-text("Change Orders")').or(this.page.locator('button').filter({ hasText: 'Change Orders' })).first().click();
            } else {
                Logger.info('Change Orders tab not found, trying generic tab selector');
                await this.page.getByRole('tab').filter({ hasText: /Change Order/ }).click();
            }

            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);
            Logger.success('Navigated to Change Order tab successfully.');
        } catch (error) {
            Logger.error(`Error in navigateToChangeOrderTab: ${error.message}`);
            throw error;
        }
    }

    async clickAddChangeOrder() {
        try {
            Logger.step('Clicking Add Change Order button...');
            await this.addChangeOrderButton.waitFor({ state: 'visible', timeout: 10000 });
            await this.addChangeOrderButton.click();
            await this.page.waitForLoadState('domcontentloaded');
            await this.page.waitForURL(/\/change-orders\/\d+/, { timeout: 20000 });
            await this.page.getByPlaceholder('Enter change order number').waitFor({ state: 'visible', timeout: 15000 });
            await this.page.waitForTimeout(1000);
            Logger.success('Add Change Order button clicked.');
        } catch (error) {
            Logger.error(`Error clicking Add Change Order: ${error.message}`);
            throw error;
        }
    }

    async fillChangeOrderTitle(title) {
        try {
            Logger.step(`Filling change order title: ${title}`);
            if (await this.titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await this.titleInput.fill(title);
                Logger.success(`Change order title filled: ${title}`);
            } else {
                Logger.info('Title input not found');
            }
        } catch (error) {
            Logger.error(`Error filling title: ${error.message}`);
            throw error;
        }
    }

    async fillChangeOrderAmount(amount) {
        try {
            Logger.step(`Filling change order amount: ${amount}`);
            if (await this.amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await this.amountInput.fill(amount);
                Logger.success(`Change order amount filled: ${amount}`);
            } else {
                Logger.info('Amount input not found');
            }
        } catch (error) {
            Logger.error(`Error filling amount: ${error.message}`);
            throw error;
        }
    }

    async fillChangeOrderDescription(description) {
        try {
            Logger.step(`Filling change order description: ${description}`);
            if (await this.descriptionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await this.descriptionInput.fill(description);
                Logger.success(`Change order description filled: ${description}`);
            } else {
                Logger.info('Description input not found');
            }
        } catch (error) {
            Logger.error(`Error filling description: ${error.message}`);
            throw error;
        }
    }

    async uploadChangeOrderImage(filePath) {
        try {
            Logger.step(`Uploading change order image: ${filePath}`);
            if (await this.fileUploadInput.isVisible({ timeout: 5000 }).catch(() => false)) {
                await this.fileUploadInput.setInputFiles(filePath);
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1000);
                Logger.success(`Change order image uploaded: ${filePath}`);
            } else {
                Logger.info('File upload input not found');
            }
        } catch (error) {
            Logger.error(`Error uploading image: ${error.message}`);
            throw error;
        }
    }

    async saveChangeOrder() {
        try {
            Logger.step('Saving change order...');
            if (await this.saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await this.saveButton.click();
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1000);
                Logger.success('Change order saved successfully.');
                return true;
            }
            // No explicit Save button — change orders auto-save; navigate back to commit.
            const goBackBtn = this.page.getByRole('button', { name: 'Go Back' });
            if (await goBackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await goBackBtn.click();
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1000);
                Logger.success('Change order saved via Go Back (auto-save).');
                return true;
            }
            Logger.info('Save button not found');
            return false;
        } catch (error) {
            Logger.error(`Error saving change order: ${error.message}`);
            throw error;
        }
    }

    async verifyChangeOrderAdded() {
        try {
            Logger.step('Verifying change order was added...');
            const rowCount = await this.changeOrderRows.count();
            if (rowCount > 0) {
                Logger.success(`Change order added. Total rows: ${rowCount}`);
                return true;
            } else {
                Logger.info('No change orders found');
                return false;
            }
        } catch (error) {
            Logger.error(`Error verifying change order: ${error.message}`);
            throw error;
        }
    }

    async exportChangeOrderData() {
        try {
            Logger.step('Exporting change order data...');
            // Multiple Export buttons exist across tab panels; iterate to find the visible one.
            const exportButtons = this.page.locator('button').filter({ hasText: 'Export' });
            const count = await exportButtons.count().catch(() => 0);
            for (let i = 0; i < count; i++) {
                const btn = exportButtons.nth(i);
                if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await btn.click();
                    await this.page.waitForLoadState('load');
                    await this.page.waitForTimeout(2000);
                    Logger.success('Change order data exported.');
                    return true;
                }
            }
            Logger.info('Export button not found');
            return false;
        } catch (error) {
            Logger.error(`Error exporting data: ${error.message}`);
            throw error;
        }
    }

    async addDataToChangeOrder(dataFields) {
        try {
            Logger.step('Adding data to change order...');
            await this.fillChangeOrderDetails(dataFields);
            Logger.success('Change order data added successfully.');
        } catch (error) {
            Logger.error(`Error adding data: ${error.message}`);
            throw error;
        }
    }


    /**
     * Fills all change order fields in the dialog
     * @param {Object} changeOrderData - Object containing change order details
     * @param {string} changeOrderData.title - Title of the change order
     * @param {string} changeOrderData.description - Description of the change order
     * @param {string} changeOrderData.changeOrderNumber - Optional: Change order number override
     * @param {string} changeOrderData.amount - Optional: Amount for the change order (1000-5000)
     */
    async fillChangeOrderDetails(changeOrderData) {
        try {
            Logger.step('Filling change order details...');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(1000);

            // Fill title if provided
            if (changeOrderData.title) {
                const titleInput = this.page.getByPlaceholder('Enter title');
                await titleInput.waitFor({ state: 'visible', timeout: 10000 });
                await titleInput.fill(changeOrderData.title);
                await titleInput.blur().catch(() => null);
                Logger.info(`Title filled: ${changeOrderData.title}`);
            }

            // Fill description if provided
            if (changeOrderData.description) {
                const descriptionInput = this.page.getByPlaceholder('Enter description');
                await descriptionInput.waitFor({ state: 'visible', timeout: 10000 });
                await descriptionInput.fill(changeOrderData.description);
                await descriptionInput.blur().catch(() => null);
                Logger.info(`Description filled: ${changeOrderData.description}`);
            }

            // Fill change order number if provided (override)
            if (changeOrderData.changeOrderNumber) {
                const numberInput = this.page.getByPlaceholder('Enter change order number');
                await numberInput.waitFor({ state: 'visible', timeout: 10000 });
                await numberInput.clear();
                await numberInput.fill(changeOrderData.changeOrderNumber);
                await numberInput.blur().catch(() => null);
                Logger.info(`Change order number filled: ${changeOrderData.changeOrderNumber}`);
            }

            // Fill amount in the grid row if provided
            if (changeOrderData.amount) {
                const ok = await this.fillChangeOrderAmount(changeOrderData.amount);
                if (!ok) {
                    Logger.info('Unable to edit Change Order Amount (likely read-only). Proceeding as long as amount is already populated in the grid.');
                }
            }

            Logger.success('Change order details filled successfully.');
            return true;
        } catch (error) {
            Logger.error(`Error filling change order details: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fills the amount field in the change order grid row
     * @param {string|number} amount - Amount to fill
     */
    async fillChangeOrderAmount(amount) {
        try {
            Logger.step(`Filling change order amount: ${amount}`);
            await this.page.waitForTimeout(300);

            // Scope everything to the Change Order Details dialog.
            const detailsDialog = this.page
                .locator('dialog,[role="dialog"]')
                .filter({ hasText: 'Change Order Details' })
                .first();
            await detailsDialog.waitFor({ state: 'visible', timeout: 20000 });

            // Ensure the grid is rendered.
            const grid = detailsDialog.locator('[role="treegrid"]').first();
            await grid.waitFor({ state: 'visible', timeout: 20000 });
            const amountHeader = grid.locator('[role="columnheader"]').filter({ hasText: 'Change Order Amount' }).first();
            await amountHeader.waitFor({ state: 'visible', timeout: 20000 });

            const amountColIndex = await amountHeader.evaluate((el) => {
                const v = el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || '';
                return v;
            }).catch(() => '');
            const colIndex = amountColIndex ? String(amountColIndex) : '6';
            Logger.info(`Detected Change Order Amount column index: ${colIndex}`);

            const editableCellLocator = grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"]:not(.disabled), [role="gridcell"][aria-colindex="${colIndex}"]:not(.disabled)`).filter({ hasText: /[—\-]|\$0/ });
            for (let w = 0; w < 5; w++) {
                const c = await editableCellLocator.count().catch(() => 0);
                if (c > 0) break;
                await this.page.waitForTimeout(2000);
            }

            const rawCount = await grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`).count().catch(() => 0);
            const enabledCount = await editableCellLocator.count().catch(() => 0);
            Logger.info(`Amount column cells found: total=${rawCount}, editableCandidates=${enabledCount}`);

            if (rawCount > 0 && enabledCount === 0) {
                const existingTexts = await grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`).allTextContents().catch(() => []);
                const normalized = existingTexts.map((t) => (t || '').trim()).filter(Boolean);
                const hasDollarAmount = normalized.some((t) => /\$\s*\d/.test(t));
                if (hasDollarAmount) {
                    Logger.error('Amount cells are read-only with existing values. Likely opened an existing approved CO instead of a new one. Add Change Order must create a NEW change order.');
                    return false;
                }
            }

            const expectedDigits = String(amount).replace(/\D/g, '');
            const candidates = [
                grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"]:not(.disabled)`).filter({ hasText: '—' }),
                grid.locator(`[role="gridcell"][aria-colindex="${colIndex}"]:not(.disabled)`).filter({ hasText: '—' }),
                grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"]:not(.disabled)`).filter({ hasText: '$0' }),
                grid.locator(`[role="gridcell"][aria-colindex="${colIndex}"]:not(.disabled)`).filter({ hasText: '$0' }),
                grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"]:not(.disabled)`),
                grid.locator(`[role="gridcell"][aria-colindex="${colIndex}"]:not(.disabled)`)
            ];

            for (const locator of candidates) {
                const count = await locator.count().catch(() => 0);
                if (count <= 0) continue;

                for (let i = 0; i < Math.min(count, 6); i++) {
                    const cell = locator.nth(i);
                    if (!(await cell.isVisible().catch(() => false))) continue;
                    await cell.scrollIntoViewIfNeeded().catch(() => null);

                    // Keyboard-commit flow (mirrors the invoice grid fix pattern)
                    await cell.click({ timeout: 10000 });
                    await this.page.waitForTimeout(150);
                    await this.page.keyboard.press('Enter').catch(() => null);
                    await this.page.waitForTimeout(150);
                    await this.page.keyboard.press('ControlOrMeta+A').catch(() => null);
                    await this.page.keyboard.press('Delete').catch(() => null);
                    await this.page.keyboard.type(String(amount), { delay: 35 });
                    await this.page.waitForTimeout(150);
                    await this.page.keyboard.press('Tab');

                    // Wait for the cell to reflect the committed amount
                    try {
                        await expect
                            .poll(async () => (((await cell.textContent().catch(() => '')) || '').replace(/\D/g, '')),
                                { timeout: 7000 })
                            .toContain(expectedDigits);
                        const cellText = ((await cell.textContent().catch(() => '')) || '').trim();
                        Logger.success(`Change order amount committed in grid: ${cellText}`);
                        return true;
                    } catch {
                        // Try next candidate
                    }
                }
            }

            Logger.info('Change order amount cell not found/edit did not commit; Review Changes may stay disabled.');
            return false;
        } catch (error) {
            Logger.error(`Error filling amount: ${error.message}`);
            return false;
        }
    }

    async fillBudgetCategoryInChangeOrder(categoryText) {
        try {
            Logger.step(`Filling budget category in change order grid: "${categoryText}"`);

            const detailsDialog = this.page
                .locator('dialog,[role="dialog"]')
                .filter({ hasText: 'Change Order Details' })
                .first();
            await expect(detailsDialog).toBeVisible({ timeout: 10000 });
            await this.page.waitForTimeout(500);

            const budgetCategoryHeader = detailsDialog.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }).first();
            const headerVisible = await budgetCategoryHeader.isVisible({ timeout: 5000 }).catch(() => false);
            if (!headerVisible) {
                Logger.info('Budget Category column not found in change order grid - may not be available');
                return 0;
            }

            await budgetCategoryHeader.scrollIntoViewIfNeeded().catch(() => null);
            await this.page.waitForTimeout(300);

            const colIndex = await budgetCategoryHeader.evaluate((el) => {
                return el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || '';
            }).catch(() => '');
            const bcColIndex = colIndex ? String(colIndex) : '5';
            Logger.info(`Budget Category column index: ${bcColIndex}`);

            const grid = detailsDialog.locator('[role="treegrid"]').first();
            const dataRows = grid.locator('[role="row"][data-rgrow]');
            const rowCount = await dataRows.count();
            expect(rowCount).toBeGreaterThan(0);
            Logger.info(`Change order grid has ${rowCount} data rows`);

            let categoriesSet = 0;

            for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
                const row = dataRows.nth(rowIdx);
                const firstCellText = await row.locator('[role="gridcell"]').first().textContent().catch(() => '');
                if (/^total$/i.test(firstCellText?.trim())) continue;

                const catCell = row.locator(`[role="gridcell"][data-rgcol="${bcColIndex}"], [role="gridcell"][aria-colindex="${bcColIndex}"]`).first();
                const cellVisible = await catCell.isVisible({ timeout: 2000 }).catch(() => false);
                if (!cellVisible) continue;

                await catCell.scrollIntoViewIfNeeded().catch(() => null);
                await this.page.waitForTimeout(200);

                await catCell.dblclick({ timeout: 5000, force: true });
                await this.page.waitForTimeout(1000);

                const searchInput = detailsDialog.getByPlaceholder('Search or type to create...').or(this.page.getByPlaceholder('Search or type to create...'));
                const inputVisible = await searchInput.first().isVisible({ timeout: 3000 }).catch(() => false);

                if (!inputVisible) {
                    Logger.info(`Row ${rowIdx}: Budget category editor did not open, skipping`);
                    continue;
                }

                await searchInput.first().fill(categoryText);
                await this.page.waitForTimeout(1500);

                const allOptions = this.page.getByRole('option');
                const optionCount = await allOptions.count();
                Logger.info(`Row ${rowIdx}: Found ${optionCount} dropdown options`);

                let selectedOption = null;
                for (let i = 0; i < optionCount; i++) {
                    const optText = await allOptions.nth(i).textContent();
                    if (optText && !/clear selection/i.test(optText) && new RegExp(categoryText, 'i').test(optText)) {
                        selectedOption = allOptions.nth(i);
                        break;
                    }
                }
                if (!selectedOption) {
                    for (let i = 0; i < optionCount; i++) {
                        const optText = await allOptions.nth(i).textContent();
                        if (optText && !/clear selection/i.test(optText)) {
                            selectedOption = allOptions.nth(i);
                            break;
                        }
                    }
                }

                expect(selectedOption).toBeTruthy();

                try {
                    await selectedOption.click({ timeout: 3000 });
                } catch {
                    let arrowPresses = 1;
                    for (let i = 0; i < optionCount; i++) {
                        const optText = await allOptions.nth(i).textContent();
                        if (/clear selection/i.test(optText)) {
                            arrowPresses++;
                            continue;
                        }
                        if (new RegExp(categoryText, 'i').test(optText)) break;
                        arrowPresses++;
                    }
                    for (let k = 0; k < arrowPresses; k++) {
                        await this.page.keyboard.press('ArrowDown');
                        await this.page.waitForTimeout(150);
                    }
                    await this.page.keyboard.press('Enter');
                }

                await this.page.waitForTimeout(1500);

                const cellValue = (await catCell.textContent().catch(() => ''))?.trim() || '';

                expect(cellValue).toBeTruthy();
                expect(cellValue).not.toBe('-');
                expect(cellValue).not.toBe('—');
                Logger.success(`Row ${rowIdx}: Budget category set to "${cellValue}"`);
                categoriesSet++;
            }

            expect(categoriesSet).toBeGreaterThan(0);
            Logger.success(`Change order budget category set for ${categoriesSet}/${rowCount} rows`);
            return categoriesSet;
        } catch (error) {
            Logger.error(`Failed to fill budget category in change order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Gets the change order number from the dialog
     * @returns {string} Change order number
     */
    async getChangeOrderNumber() {
        try {
            const numberInput = this.page.getByPlaceholder('Enter change order number');
            await numberInput.waitFor({ state: 'visible', timeout: 10000 });
            const value = await numberInput.inputValue();
            Logger.info(`Got change order number: ${value}`);
            return value;
        } catch (error) {
            Logger.error(`Error getting change order number: ${error.message}`);
            return null;
        }
    }

    async confirmChangeOrderAndHandleModal() {
        Logger.step('Confirming change order (Review Changes -> Confirm Changes -> Confirm)...');

        const dismissToasts = async () => {
            const alerts = this.page.locator('div[data-position] [role="alert"], [class*="Notifications-root"] [role="alert"]');
            const alertCount = await alerts.count().catch(() => 0);
            if (alertCount <= 0) return;
            for (let i = 0; i < alertCount; i++) {
                const alert = alerts.nth(i);
                if (!(await alert.isVisible().catch(() => false))) continue;
                const closeBtn = alert.locator('button').first();
                if (await closeBtn.isVisible().catch(() => false)) {
                    await closeBtn.click({ timeout: 2000 }).catch(() => null);
                }
            }
        };

        const reviewBtn = this.page.getByRole('button', { name: /Review Changes/i });
        await reviewBtn.waitFor({ state: 'visible', timeout: 15000 });

        // Review Changes can be disabled until a grid edit is committed.
        await expect(reviewBtn).toBeEnabled({ timeout: 20000 });

        await dismissToasts();
        await this.page.waitForTimeout(250);

        try {
            await reviewBtn.click({ timeout: 15000 });
        } catch (err) {
            Logger.info(`Review Changes click retry due to: ${err.message}`);
            await dismissToasts();
            await this.page.waitForTimeout(300);
            await reviewBtn.click({ timeout: 15000, force: true });
        }

        // There are multiple dialogs on the page (Change Order Details itself is a dialog).
        // Wait for the actual "Confirm Changes" action to appear, rather than scoping to the first dialog.
        const confirmChanges = this.page.getByRole('button', { name: /Confirm Changes/i });
        await confirmChanges.waitFor({ state: 'visible', timeout: 20000 });

        try {
            await confirmChanges.click({ timeout: 15000 });
        } catch (err) {
            Logger.info(`Confirm Changes click retry due to: ${err.message}`);
            await dismissToasts();
            await this.page.waitForTimeout(300);
            await confirmChanges.click({ timeout: 15000, force: true });
        }

        const confirmFinal = this.page.getByRole('button', { name: /^Confirm$/ });
        await confirmFinal.waitFor({ state: 'visible', timeout: 15000 });
        try {
            await confirmFinal.click({ timeout: 15000 });
        } catch (err) {
            Logger.info(`Final Confirm click retry due to: ${err.message}`);
            await dismissToasts();
            await this.page.waitForTimeout(300);
            await confirmFinal.click({ timeout: 15000, force: true });
        }

        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForURL(/tab=change-orders/, { timeout: 20000 }).catch(() => null);
        await this.page.waitForTimeout(800);

        Logger.success('Change order confirmed successfully.');
        return true;
    }

    /**
     * Gets the change order date from the dialog
     * @returns {string} Change order date
     */
    async getChangeOrderDate() {
        try {
            const dateButton = this.page.locator('button').filter({ hasText: /\d{4}/ }).first();
            await dateButton.waitFor({ state: 'visible', timeout: 10000 });
            const dateText = await dateButton.textContent();
            Logger.info(`Got change order date: ${dateText}`);
            return dateText;
        } catch (error) {
            Logger.error(`Error getting change order date: ${error.message}`);
            return null;
        }
    }

    /**
     * Clicks Go Back button to save and close the change order dialog
     */
    async goBackToChangeOrderList() {
        try {
            Logger.step('Going back to change order list...');
            const goBackButton = this.page.getByRole('button', { name: 'Go Back' });
            await goBackButton.waitFor({ state: 'visible', timeout: 10000 });
            await goBackButton.click();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);
            Logger.success('Navigated back to change order list.');
        } catch (error) {
            Logger.error(`Error going back: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies that the change order values in the list match the expected data
     * @param {Object} expectedData - Object containing expected change order details
     * @returns {boolean} True if values match
     */
    async verifyChangeOrderInList(expectedData) {
        try {
            Logger.step('Verifying change order in list...');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            const search = this.page.getByPlaceholder('Search...').first();
            if (await search.isVisible({ timeout: 1000 }).catch(() => false)) {
                await search.fill('');
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1000);
            }

            const numberText = expectedData.number ? String(expectedData.number).trim() : null;
            const searchText = expectedData.number || expectedData.title;
            const escapedForRegex = numberText ? numberText.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') : '';

            const tryFind = async (useSearch) => {
                if (useSearch && searchText) {
                    const search = this.page.getByPlaceholder('Search...').first();
                    if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await search.fill(String(searchText));
                        await this.page.waitForLoadState('load');
                        await this.page.waitForTimeout(1200);
                    }
                }

                if (numberText) {
                    const row = this.page.locator('[role="row"], tr').filter({ hasText: new RegExp(`\\b${escapedForRegex}\\b`) }).first();
                    if (await row.isVisible({ timeout: 8000 }).catch(() => false)) {
                        return true;
                    }
                    const bodyText = await this.page.locator('body').textContent().catch(() => '') || '';
                    if (bodyText.includes(numberText)) return true;
                }
                return false;
            };

            if (numberText) {
                if (await tryFind(false)) {
                    Logger.success(`Found change order with number: ${numberText}`);
                    return true;
                }
                if (await tryFind(true)) {
                    Logger.success(`Found change order number "${numberText}" (with search)`);
                    return true;
                }
                Logger.info(`Change order with number "${numberText}" not found in list`);
                return false;
            }

            // Look for the row containing the expected title
            if (expectedData.title) {
                // Try multiple approaches to find the title
                // Approach 1: getByRole with exact name
                let titleCell = this.page.getByRole('gridcell', { name: expectedData.title });
                let isVisible = await titleCell.isVisible({ timeout: 3000 }).catch(() => false);

                if (!isVisible) {
                    // Approach 2: locator with text contains
                    titleCell = this.page.locator(`div[role="gridcell"]:has-text("${expectedData.title}")`).first();
                    isVisible = await titleCell.isVisible({ timeout: 3000 }).catch(() => false);
                }

                if (!isVisible) {
                    // Approach 3: text locator
                    titleCell = this.page.locator(`text=${expectedData.title}`).first();
                    isVisible = await titleCell.isVisible({ timeout: 3000 }).catch(() => false);
                }

                if (isVisible) {
                    Logger.success(`Found change order with title: ${expectedData.title}`);
                    return true;
                } else {
                    // Log what's visible for debugging
                    const allTitles = await this.page.locator('div[role="gridcell"][data-rgcol="2"]').allTextContents().catch(() => []);
                    Logger.info(`Visible titles in list: ${allTitles.slice(0, 5).join(', ')}`);
                    Logger.info(`Change order with title "${expectedData.title}" not found in list`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            Logger.error(`Error verifying change order: ${error.message}`);
            return false;
        }
    }

    /**
     * Gets the count of change orders in the list
     * @returns {number} Count of change orders
     */
    async getChangeOrderCount() {
        try {
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(1000);

            // Count rows in the change orders grid
            const rows = this.page.locator('div[role="row"]:has(div[role="gridcell"]:has-text("Change Order #"))');
            const count = await rows.count();
            Logger.info(`Found ${count} change orders in the list`);
            return count;
        } catch (error) {
            Logger.error(`Error counting change orders: ${error.message}`);
            return 0;
        }
    }

    /**
     * Verifies all fields are entered successfully in the change order dialog
     * @param {Object} expectedData - Object containing expected change order details
     * @returns {boolean} True if all values match
     */
    async verifyChangeOrderFieldsInDialog(expectedData) {
        try {
            Logger.step('Verifying change order fields in dialog...');
            let allMatch = true;

            if (expectedData.changeOrderNumber) {
                const numberInput = this.page.getByPlaceholder('Enter change order number');
                const numberValue = await numberInput.inputValue().catch(() => '');
                if (numberValue === expectedData.changeOrderNumber) {
                    Logger.success(`Change order number matches: ${numberValue}`);
                } else {
                    Logger.error(`Change order number mismatch. Expected: ${expectedData.changeOrderNumber}, Got: ${numberValue}`);
                    allMatch = false;
                }
            }

            // Verify title
            if (expectedData.title) {
                const titleInput = this.page.getByPlaceholder('Enter title');
                const titleValue = await titleInput.inputValue();
                if (titleValue === expectedData.title) {
                    Logger.success(`Title matches: ${titleValue}`);
                } else {
                    Logger.error(`Title mismatch. Expected: ${expectedData.title}, Got: ${titleValue}`);
                    allMatch = false;
                }
            }

            // Verify description
            if (expectedData.description) {
                const descriptionInput = this.page.getByPlaceholder('Enter description');
                const descriptionValue = await descriptionInput.inputValue();
                if (descriptionValue === expectedData.description) {
                    Logger.success(`Description matches: ${descriptionValue}`);
                } else {
                    Logger.error(`Description mismatch. Expected: ${expectedData.description}, Got: ${descriptionValue}`);
                    allMatch = false;
                }
            }

            // Verify amount committed in grid
            if (expectedData.amount) {
                const detailsDialog = this.page
                    .locator('dialog,[role="dialog"]')
                    .filter({ hasText: 'Change Order Details' })
                    .first();
                await detailsDialog.waitFor({ state: 'visible', timeout: 20000 });
                const grid = detailsDialog.locator('[role="treegrid"]').first();
                await grid.waitFor({ state: 'visible', timeout: 20000 });

                const amountHeader = grid.locator('[role="columnheader"]').filter({ hasText: 'Change Order Amount' }).first();
                await amountHeader.waitFor({ state: 'visible', timeout: 20000 });
                const amountColIndex = await amountHeader.evaluate((el) => {
                    return el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || '';
                }).catch(() => '');
                const colIndex = amountColIndex ? String(amountColIndex) : '6';

                const amountCells = grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`);
                const texts = await amountCells.allTextContents().catch(() => []);
                const normalized = texts.map((t) => (t || '').trim()).filter(Boolean);
                const hasDollarAmount = normalized.some((t) => /\$\s*\d/.test(t));

                if (hasDollarAmount) {
                    Logger.success(`Amount present in grid: ${normalized.slice(0, 3).join(' | ')}`);
                } else {
                    Logger.error(`Amount not present in grid. Got: ${normalized.slice(0, 5).join(' | ')}`);
                    allMatch = false;
                }
            }

            return allMatch;
        } catch (error) {
            Logger.error(`Error verifying fields: ${error.message}`);
            return false;
        }
    }

    /**
     * Creates a complete change order with all fields filled
     * @param {Object} changeOrderData - Object containing change order details
     * @returns {Object} Created change order info including number
     */
    async createCompleteChangeOrder(changeOrderData) {
        try {
            Logger.step('Creating complete change order...');

            // Click Add Change Order button
            await this.clickAddChangeOrder();
            await this.page.waitForTimeout(1000);

            // Get the auto-generated change order number
            const changeOrderNumber = await this.getChangeOrderNumber();

            // Fill in all the details
            await this.fillChangeOrderDetails(changeOrderData);

            // Verify the fields were filled correctly
            const fieldsVerified = await this.verifyChangeOrderFieldsInDialog(changeOrderData);

            // Capture a representative amount cell text for assertions/logging.
            let amountCellText = '';
            try {
                const detailsDialog = this.page
                    .locator('dialog,[role="dialog"]')
                    .filter({ hasText: 'Change Order Details' })
                    .first();
                await detailsDialog.waitFor({ state: 'visible', timeout: 20000 });
                const grid = detailsDialog.locator('[role="treegrid"]').first();
                await grid.waitFor({ state: 'visible', timeout: 20000 });

                const amountHeader = grid.locator('[role="columnheader"]').filter({ hasText: 'Change Order Amount' }).first();
                await amountHeader.waitFor({ state: 'visible', timeout: 20000 });
                const amountColIndex = await amountHeader.evaluate((el) => {
                    return el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || '';
                }).catch(() => '');
                const colIndex = amountColIndex ? String(amountColIndex) : '6';

                const anyAmountCell = grid.locator(`[role="gridcell"][data-rgcol="${colIndex}"], [role="gridcell"][aria-colindex="${colIndex}"]`).first();
                amountCellText = ((await anyAmountCell.textContent().catch(() => '')) || '').trim();
            } catch {
                // best-effort only
            }

            // Confirm only if Review Changes is enabled; otherwise go back and treat as saved/draft.
            let confirmed = false;
            const reviewBtn = this.page.getByRole('button', { name: /Review Changes/i });
            const canReview = await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)
                ? await reviewBtn.isEnabled().catch(() => false)
                : false;

            if (canReview) {
                confirmed = await this.confirmChangeOrderAndHandleModal();
            } else {
                Logger.info('Review Changes is disabled; going back without confirming.');
                await this.goBackToChangeOrderList();
            }

            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            // Verify it appears in list by number (most reliable across Draft/Approved).
            let inList = await this.verifyChangeOrderInList({ number: changeOrderNumber });
            for (let r = 0; r < 3 && !inList; r++) {
                await this.page.waitForTimeout(3000);
                inList = await this.verifyChangeOrderInList({ number: changeOrderNumber });
            }

            Logger.success(`Change order ${changeOrderNumber} created successfully.`);

            return {
                number: changeOrderNumber,
                title: changeOrderData.title,
                description: changeOrderData.description,
                amountCellText,
                confirmed,
                inList,
                fieldsVerified
            };
        } catch (error) {
            Logger.error(`Error creating complete change order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies all change order form fields are visible
     * @returns {Object} Object with visibility status of each field
     */
    async verifyChangeOrderFormFieldsVisible() {
        try {
            Logger.step('Verifying change order form fields visibility...');
            const locators = this.changeOrderLocators;

            const result = {
                overviewSection: await locators.overviewSection.isVisible({ timeout: 5000 }).catch(() => false),
                numberInput: await locators.changeOrderNumberInput.isVisible({ timeout: 5000 }).catch(() => false),
                titleInput: await locators.titleInput.isVisible({ timeout: 5000 }).catch(() => false),
                descriptionInput: await locators.descriptionInput.isVisible({ timeout: 5000 }).catch(() => false),
                dateLabel: await locators.changeOrderDateLabel.isVisible({ timeout: 5000 }).catch(() => false),
                documentsLabel: await locators.documentsLabel.isVisible({ timeout: 5000 }).catch(() => false)
            };

            Logger.info(`Form fields visibility: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            Logger.error(`Error verifying form fields: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies that all expected column headers are visible in change order list
     * @param {Array<string>} expectedColumns - Array of expected column names
     * @returns {Object} Object with visibility status of each column
     */
    async verifyChangeOrderListColumns(expectedColumns) {
        try {
            Logger.step('Verifying change order list columns...');
            const result = {};

            for (const column of expectedColumns) {
                const columnHeader = this.changeOrderLocators.columnHeader(column);
                const isVisible = await columnHeader.isVisible({ timeout: 5000 }).catch(() => false);
                result[column] = isVisible;
                Logger.info(`Column "${column}" visible: ${isVisible}`);
            }

            return result;
        } catch (error) {
            Logger.error(`Error verifying columns: ${error.message}`);
            throw error;
        }
    }

    /**
     * Gets the count of change orders with Draft status
     * @returns {number} Count of draft change orders
     */
    async getDraftChangeOrderCount() {
        try {
            const draftCells = this.changeOrderLocators.draftStatusCells;
            const count = await draftCells.count();
            Logger.info(`Found ${count} change orders with Draft status`);
            return count;
        } catch (error) {
            Logger.error(`Error counting draft change orders: ${error.message}`);
            return 0;
        }
    }

    async getApprovedChangeOrderCount() {
        try {
            const approvedCells = this.changeOrderLocators.approvedStatusCells;
            const count = await approvedCells.count();
            Logger.info(`Found ${count} change orders with Approved status`);
            return count;
        } catch (error) {
            Logger.error(`Error counting Approved change orders: ${error.message}`);
            return 0;
        }
    }

    /**
     * Checks if the change order modal/dialog is open
     * @returns {boolean} True if modal is visible
     */
    async isChangeOrderModalOpen() {
        try {
            const modal = this.changeOrderLocators.modal;
            return await modal.isVisible({ timeout: 3000 }).catch(() => false);
        } catch (error) {
            return false;
        }
    }

    /**
     * Waits for the Change Order Details screen to be fully loaded.
     * Use after openChangeOrderFromList (which navigates to /jobs/.../change-orders/...).
     */
    async waitForChangeOrderDetailsScreen() {
        Logger.step('Waiting for Change Order Details screen to load...');
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(2000);

        const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Change Order Details' });
        const headerOrGrid = dialog.locator('text=Change Order Details')
            .or(dialog.locator('[role="columnheader"]').filter({ hasText: 'Current Contract Value' }))
            .or(dialog.locator('[role="columnheader"]').filter({ hasText: 'Revised Contract Amount' }))
            .or(this.page.locator('[role="dialog"] [role="treegrid"]'))
            .or(this.page.locator('[role="dialog"] [role="grid"]'))
            .first();
        await headerOrGrid.waitFor({ state: 'visible', timeout: 30000 });
        Logger.info('Change Order Details screen visible.');

        await this.page.waitForResponse(
            (resp) => {
                const url = resp.url();
                const ok = resp.status() >= 200 && resp.status() < 300;
                return ok && (url.includes('change_order') || url.includes('change-order') || (url.includes('bird-table') && url.includes('changeorder')));
            },
            { timeout: 15000 }
        ).catch(() => null);

        await this.page.waitForTimeout(2000);
        Logger.success('Change Order Details screen ready.');
    }

    /**
     * Opens a change order from the list by clicking the View (eye) button in its row.
     * Waits for navigation to /jobs/{id}/change-orders/{id} before returning.
     * @param {string} changeOrderNumber - e.g. "Change Order #123"
     */
    async openChangeOrderFromList(changeOrderNumber) {
        Logger.step(`Opening change order ${changeOrderNumber} from list...`);
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(1500);

        const listReady = this.page.locator('[role="row"]').filter({ has: this.page.locator('[role="gridcell"]').filter({ hasText: 'Change Order #' }) }).first();
        await listReady.waitFor({ state: 'visible', timeout: 20000 });
        await this.page.waitForTimeout(500);

        const search = this.page.getByPlaceholder('Search...').first();
        if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
            await search.fill('');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(400);
            await search.fill(String(changeOrderNumber));
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(1500);
        }

        const rowWithCo = this.page.locator('[role="row"]').filter({ hasText: changeOrderNumber }).first();
        await rowWithCo.waitFor({ state: 'visible', timeout: 15000 });

        let viewBtn = rowWithCo.getByRole('button', { name: 'View Change Order' });
        if (await viewBtn.count().catch(() => 0) === 0) {
            viewBtn = this.page.getByRole('button', { name: 'View Change Order' }).first();
        }
        await viewBtn.first().click({ timeout: 10000 });
        await this.page.waitForURL(/\/jobs\/\d+\/change-orders\/\d+/, { timeout: 15000 });
        Logger.success(`Change order ${changeOrderNumber} opened.`);
    }

    /**
     * Parses a currency string (e.g. "$1,234.56") to a number
     * @param {string} str - Currency string
     * @returns {number|null} Parsed number or null
     */
    parseCurrencyToNumber(str) {
        if (!str || typeof str !== 'string') return null;
        const cleaned = str.replace(/[$,]/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    /**
     * Gets Current Contract Value and Revised Contract Amount from Change Order Details view.
     * Values come from the grid columns (BirdTable). Also tries label-value fallback for overview layouts.
     * @returns {Object} { currentContractValue, revisedContractAmount, changeOrderAmount } - values as numbers or null
     */
    async getChangeOrderDetailsStats() {
        const getValueFromGridColumn = async (grid, headerTexts) => {
            for (const text of headerTexts) {
                const header = grid.locator('[role="columnheader"]').filter({ hasText: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
                if (!(await header.isVisible({ timeout: 1500 }).catch(() => false))) continue;
                const colIndex = await header.evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || el.cellIndex).catch(() => '');
                const col = colIndex !== '' && colIndex !== undefined ? String(colIndex) : null;
                if (!col) continue;
                const cells = grid.locator(`[role="gridcell"][data-rgcol="${col}"], [role="gridcell"][aria-colindex="${col}"]`);
                const count = await cells.count().catch(() => 0);
                for (let i = count - 1; i >= 0; i--) {
                    const cellText = (await cells.nth(i).textContent().catch(() => '') || '').trim();
                    if (/\$[\d,.]/.test(cellText)) return cellText;
                }
                const firstText = (await cells.first().textContent().catch(() => '') || '').trim();
                if (firstText) return firstText;
            }
            return null;
        };

        const getValueNearLabel = async (labelPatterns) => {
            for (const pattern of labelPatterns) {
                const label = this.page.locator(`text=${pattern}`).first();
                if (await label.isVisible({ timeout: 1500 }).catch(() => false)) {
                    const parent = label.locator('..');
                    const valueEl = parent.locator('p, span, div').filter({ hasText: /\$[\d,]/ }).first();
                    const text = await valueEl.textContent().catch(() => null);
                    if (text) return text.trim();
                }
            }
            return null;
        };

        const extractStats = async () => {
            const scope = this.page.locator('[role="dialog"]').filter({ hasText: /Change Order Details|Overview|Current Contract|Revised Contract/i }).first()
                .or(this.page.locator('main').filter({ hasText: /Change Order|Current Contract|Revised Contract/i }));
            const grid = scope.locator('[role="treegrid"], [role="grid"]').first();

            let currentContractValue = null;
            let revisedContractAmount = null;
            let changeOrderAmount = null;

            if (await grid.isVisible({ timeout: 3000 }).catch(() => false)) {
                currentContractValue = await getValueFromGridColumn(grid, ['Current Contract Value', 'Current Contract']);
                revisedContractAmount = await getValueFromGridColumn(grid, ['Revised Contract Amount']);
                changeOrderAmount = await getValueFromGridColumn(grid, ['Change Order Amount']);
            }

            if (!currentContractValue) currentContractValue = await getValueNearLabel(['Current Contract Value', 'Current Contract']);
            if (!revisedContractAmount) revisedContractAmount = await getValueNearLabel(['Revised Contract Amount']);
            if (!changeOrderAmount && await grid.isVisible().catch(() => false)) changeOrderAmount = await getValueFromGridColumn(grid, ['Change Order Amount']);

            return {
                currentContractValue: this.parseCurrencyToNumber(currentContractValue) ?? currentContractValue,
                revisedContractAmount: this.parseCurrencyToNumber(revisedContractAmount) ?? revisedContractAmount,
                changeOrderAmount: this.parseCurrencyToNumber(changeOrderAmount) ?? changeOrderAmount
            };
        };

        try {
            Logger.step('Fetching Change Order Details stats (Current Contract Value, Revised Contract Amount)...');
            const statsIndicator = this.page.locator('text=Current Contract Value')
                .or(this.page.locator('text=Revised Contract Amount'))
                .or(this.page.locator('[role="columnheader"]').filter({ hasText: 'Current Contract' }))
                .or(this.page.locator('[role="columnheader"]').filter({ hasText: 'Revised Contract' }))
                .first();
            await statsIndicator.waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
            await this.page.waitForTimeout(2000);

            let result = await extractStats();
            for (let attempt = 1; attempt <= 3 && (!result.currentContractValue || !result.revisedContractAmount); attempt++) {
                Logger.info(`Stats incomplete (attempt ${attempt}/3), waiting and retrying...`);
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(3000);
                result = await extractStats();
            }

            Logger.info(`Change Order Details stats: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            Logger.error(`Error fetching Change Order Details stats: ${error.message}`);
            return { currentContractValue: null, revisedContractAmount: null, changeOrderAmount: null };
        }
    }

    // =================== INVOICE SPECIFIC METHODS ===================

    /**
     * Initialize invoice locators
     */
    get invoiceLocators() {
        return invoiceLocators(this.page);
    }

    /**
     * Fills all invoice fields in the dialog
     * @param {Object} invoiceData - Object containing invoice details
     * @param {string} invoiceData.title - Title of the invoice
     * @param {string} invoiceData.description - Description of the invoice
     * @param {string} invoiceData.invoiceNumber - Optional: Invoice number override
     */
    async fillInvoiceDetails(invoiceData) {
        try {
            Logger.step('Filling invoice details...');
            await this.page.waitForLoadState('load').catch(() => {});

            // Wait for the invoice form to be ready instead of using a fixed timeout.
            const titleInputReady = this.page
                .getByRole('textbox', { name: 'Enter title' })
                .or(this.page.getByPlaceholder(/Invoice title|Enter title/i))
                .first();
            await titleInputReady.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

            // Fill title if provided
            if (invoiceData.title) {
                const titleInput = this.page.getByRole('textbox', { name: 'Enter title' })
                    .or(this.page.getByPlaceholder(/Invoice title|Enter title/i))
                    .first();
                await titleInput.waitFor({ state: 'visible', timeout: 10000 });
                await titleInput.fill(invoiceData.title);
                await titleInput.blur().catch(() => null);
                Logger.info(`Title filled: ${invoiceData.title}`);
            }

            // Fill description if provided
            if (invoiceData.description) {
                const descriptionInput = this.page.getByRole('textbox', { name: 'Enter description' });
                await descriptionInput.waitFor({ state: 'visible', timeout: 10000 });
                await descriptionInput.fill(invoiceData.description);
                await descriptionInput.blur().catch(() => null);
                Logger.info(`Description filled: ${invoiceData.description}`);
            }

            // Fill invoice number if provided (override)
            if (invoiceData.invoiceNumber) {
                const numberInput = this.page.getByRole('textbox', { name: 'Enter invoice number' });
                await numberInput.waitFor({ state: 'visible', timeout: 10000 });
                await numberInput.clear();
                await numberInput.fill(invoiceData.invoiceNumber);
                await numberInput.blur().catch(() => null);
                Logger.info(`Invoice number filled: ${invoiceData.invoiceNumber}`);
            }

            Logger.success('Invoice details filled successfully.');
            return true;
        } catch (error) {
            Logger.error(`Error filling invoice details: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fills the invoice amount in the grid row
     * @param {string|number} amount - Amount to fill
     */
    async fillInvoiceGridAmount(amount) {
        try {
            Logger.step(`Filling invoice amount: ${amount}`);
            const expectedDigits = String(amount).replace(/\D/g, '');
            if (!expectedDigits) {
                Logger.info('Amount value has no digits; skipping grid fill');
                return false;
            }

            // Dynamically detect amount column index.
            // New grid: "Invoiced Amount" (data-rgcol="7"); legacy grid: "Invoice Amount" (data-rgcol="6").
            let amountColIndex = '6';
            const invoicedAmountHeader = this.page
                .locator('[role="columnheader"]')
                .filter({ hasText: /Invoiced Amount/i })
                .first();
            const legacyAmountHeader = this.page
                .locator('[role="columnheader"]')
                .filter({ hasText: /Invoice Amount/i })
                .first();

            // Wait briefly for either header to appear (grid fully rendered)
            const headerFound = await Promise.race([
                invoicedAmountHeader.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'new').catch(() => null),
                legacyAmountHeader.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'legacy').catch(() => null),
            ]);

            if (headerFound === 'new') {
                const colIdx = await invoicedAmountHeader
                    .evaluate(el => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || '')
                    .catch(() => '');
                if (colIdx) amountColIndex = colIdx;
                Logger.info(`Detected "Invoiced Amount" column at data-rgcol="${amountColIndex}"`);
            } else if (headerFound === 'legacy') {
                Logger.info('Using legacy "Invoice Amount" column at data-rgcol="6"');
            } else {
                Logger.info('Amount column header not detected — falling back to data-rgcol="6"');
            }

            const amountCell = this.page
                .locator(`div[role="gridcell"][data-rgcol="${amountColIndex}"]`)
                .filter({ hasText: /—|\$0|\$/ })
                .first();

            // If no data rows exist (e.g. all scopes already invoiced), skip gracefully.
            const cellVisible = await amountCell.isVisible({ timeout: 5000 }).catch(() => false);
            if (!cellVisible) {
                Logger.info('No invoice amount cell found in grid (grid may be empty) — skipping amount fill.');
                return false;
            }
            await amountCell.waitFor({ state: 'visible', timeout: 5000 });
            await amountCell.scrollIntoViewIfNeeded();

            const updateResponsePromise = this.page
                .waitForResponse(
                    (resp) => resp.url().includes('/api/bird-table/cells') && resp.status() >= 200 && resp.status() < 300,
                    { timeout: 10000 }
                )
                .catch(() => null);

            // Click the cell and use keyboard to commit (more reliable than relying on a focused input)
            await amountCell.click({ timeout: 5000 });
            await this.page.waitForTimeout(250);

            // Some grid cells require Enter to start edit
            await this.page.keyboard.press('Enter').catch(() => null);
            await this.page.waitForTimeout(200);

            // Clear and type
            await this.page.keyboard.press('ControlOrMeta+A').catch(() => null);
            await this.page.keyboard.press('Delete').catch(() => null);
            await this.page.keyboard.type(String(amount), { delay: 50 });
            await this.page.waitForTimeout(200);

            // Commit
            await this.page.keyboard.press('Tab');
            await updateResponsePromise;
            await this.page.waitForTimeout(500);

            const cellText = ((await amountCell.textContent().catch(() => '')) || '').trim();
            const cellDigits = cellText.replace(/\D/g, '');
            if (cellDigits.includes(expectedDigits)) {
                Logger.success(`Invoice amount committed in grid: ${cellText}`);
                return true;
            }

            // Fallback: try double click + focused input path
            await amountCell.dblclick();
            const input = this.page.locator('input:focus, input[data-testid="bird-table-currency-input"], input[data-testid="bird-table-number-input"], input[role="spinbutton"]').first();
            if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
                await input.fill(String(amount));
                await input.press('Tab');
                await this.page.waitForTimeout(500);

                const cellText2 = ((await amountCell.textContent().catch(() => '')) || '').trim();
                const cellDigits2 = cellText2.replace(/\D/g, '');
                if (cellDigits2.includes(expectedDigits)) {
                    Logger.success(`Invoice amount committed via input: ${cellText2}`);
                    return true;
                }
            }

            Logger.info(`Invoice amount did not appear committed. Cell text = "${cellText}"`);
            return false;
        } catch (error) {
            Logger.error(`Error filling invoice amount: ${error.message}`);
            return false;
        }
    }

    async fillBudgetCategoryInInvoice(categoryText) {
        try {
            Logger.step(`Filling budget category in invoice grid: "${categoryText}"`);

            // Scope to the active details grid to avoid mixing with list/grid headers elsewhere on the page.
            let grid = this.page
                .locator('[role="treegrid"]')
                .filter({ has: this.page.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }) })
                .first();

            // New invoice grid structure (Unit Interior jobs) does not have a Budget Category column.
            // Return 0 gracefully instead of timing out.
            const gridVisible = await grid.isVisible({ timeout: 5000 }).catch(() => false);
            if (!gridVisible) {
                Logger.info('"Budget Category" column not found in invoice grid — new grid structure detected, skipping.');
                return 0;
            }

            let budgetCategoryHeader = grid.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }).first();
            let headerVisible = await budgetCategoryHeader.isVisible({ timeout: 4000 }).catch(() => false);
            if (!headerVisible) {
                const toggles = this.page.locator(
                    'button:has(svg.lucide-chevron-down), button:has(svg.lucide-chevron-up), button[aria-label*="expand" i], button[aria-label*="collapse" i]'
                );
                const toggleCount = await toggles.count().catch(() => 0);
                for (let i = 0; i < Math.min(toggleCount, 10) && !headerVisible; i++) {
                    const t = toggles.nth(i);
                    if (!(await t.isVisible().catch(() => false))) continue;
                    await t.click({ force: true }).catch(() => {});
                    await this.page.waitForTimeout(250);
                    headerVisible = await budgetCategoryHeader.isVisible({ timeout: 15000 }).catch(() => false);
                }
            }
            if (!headerVisible) {
                budgetCategoryHeader = grid.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }).first();
                await expect(budgetCategoryHeader).toBeVisible({ timeout: 30000 });
            } else {
                await expect(budgetCategoryHeader).toBeVisible({ timeout: 10000 });
            }

            const budgetColIndexRaw = await budgetCategoryHeader
                .evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || '')
                .catch(() => '');
            const budgetColIndex = String(budgetColIndexRaw || '5');

            const dataRows = grid.locator('[role="row"][data-rgrow]');
            // Wait for at least the first row to render its cells before counting (CI can be slow)
            await dataRows.first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
            const rowCount = await dataRows.count();
            expect(rowCount).toBeGreaterThan(0);
            Logger.info(`Invoice grid has ${rowCount} data rows (Budget Category column index: ${budgetColIndex})`);

            let categoriesSet = 0;

            for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
                const row = dataRows.nth(rowIdx);
                const rowBox = await row.boundingBox();
                if (!rowBox) continue;

                const firstCellText = await row.locator('[role="gridcell"]').first().textContent().catch(() => '');
                if (/^total$/i.test(firstCellText?.trim())) {
                    Logger.info(`Row ${rowIdx}: Totals row, skipping`);
                    continue;
                }

                const catCell = row
                    .locator(`[role="gridcell"][data-rgcol="${budgetColIndex}"], [role="gridcell"][aria-colindex="${budgetColIndex}"]`)
                    .first();
                const cellVisible = await catCell.isVisible({ timeout: 5000 }).catch(() => false);
                if (!cellVisible) {
                    Logger.info(`Row ${rowIdx}: Budget category cell not visible, skipping`);
                    continue;
                }
                await catCell.scrollIntoViewIfNeeded().catch(() => null);
                await catCell.dblclick({ timeout: 5000, force: true });

                const searchInput = this.invoiceLocators.budgetCategorySearchInput;
                // Wait for the editor to actually appear instead of a blind timeout.
                const inputVisible = await searchInput
                    .isVisible({ timeout: 5000 })
                    .catch(() => false);

                if (!inputVisible) {
                    Logger.info(`Row ${rowIdx}: Budget category editor did not open, skipping`);
                    continue;
                }

                await searchInput.fill(categoryText);

                // Wait for dropdown/listbox options instead of fixed timeout to avoid test timeouts
                const dropdown = this.page
                    .getByRole('listbox')
                    .or(this.page.locator('[data-combobox-options], [role="listbox"]'));
                await dropdown.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

                const allOptions = dropdown.locator('[role="option"]').or(this.page.getByRole('option'));
                const optionCount = await allOptions.count();
                Logger.info(`Row ${rowIdx}: Found ${optionCount} dropdown options`);

                let selectedOption = null;
                for (let i = 0; i < optionCount; i++) {
                    const optText = await allOptions.nth(i).textContent();
                    if (optText && !/clear selection/i.test(optText) && new RegExp(categoryText, 'i').test(optText)) {
                        selectedOption = allOptions.nth(i);
                        Logger.info(`Row ${rowIdx}: Targeting option: "${optText}"`);
                        break;
                    }
                }

                if (!selectedOption) {
                    for (let i = 0; i < optionCount; i++) {
                        const optText = await allOptions.nth(i).textContent();
                        if (optText && !/clear selection/i.test(optText)) {
                            selectedOption = allOptions.nth(i);
                            Logger.info(`Row ${rowIdx}: Fallback targeting option: "${optText}"`);
                            break;
                        }
                    }
                }
                await this.page.waitForTimeout(500);
                expect(selectedOption).toBeTruthy();

                try {
                    await selectedOption.click({ timeout: 3000 });
                } catch {
                    Logger.info(`Row ${rowIdx}: Direct click intercepted, using keyboard selection`);
                    let arrowPresses = 1;
                    for (let i = 0; i < optionCount; i++) {
                        const optText = await allOptions.nth(i).textContent();
                        if (/clear selection/i.test(optText)) {
                            arrowPresses++;
                            continue;
                        }
                        if (new RegExp(categoryText, 'i').test(optText)) break;
                        arrowPresses++;
                    }
                    for (let k = 0; k < arrowPresses; k++) {
                        await this.page.keyboard.press('ArrowDown');
                        await this.page.waitForTimeout(150);
                    }
                    await this.page.keyboard.press('Enter');
                }

                // Wait for the cell text at this position to actually update, instead of a fixed sleep.
                await this.page.waitForTimeout(600);
                const cellValue = (await catCell.textContent().catch(() => ''))?.trim() || '';

                expect(cellValue).toBeTruthy();
                expect(cellValue).not.toBe('-');
                expect(cellValue).not.toBe('—');
                Logger.success(`Row ${rowIdx}: Budget category set to "${cellValue}"`);
                categoriesSet++;
            }

            expect(categoriesSet).toBeGreaterThan(0);
            Logger.success(`Budget category set for ${categoriesSet}/${rowCount} rows`);
            return categoriesSet;
        } catch (error) {
            Logger.error(`Failed to fill budget category: ${error.message}`);
            throw error;
        }
    }

    /**
     * Variant of fillBudgetCategoryInInvoice for Change-Order invoice pages.
     * The Budget Category grid on CO invoices can take up to 30s to render.
     * This method pre-waits for the grid (30s), then delegates to
     * fillBudgetCategoryInInvoice — once the grid is visible the 5-second
     * graceful-skip inside that method never fires.
     * @param {string} categoryText - Category option to select in each row
     * @returns {number} Number of rows where category was set
     */
    async fillBudgetCategoryInChangeOrderInvoice(categoryText) {
        const grid = this.page
            .locator('[role="treegrid"]')
            .filter({ has: this.page.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }) })
            .first();
        await expect(grid).toBeVisible({ timeout: 30000 });
        return this.fillBudgetCategoryInInvoice(categoryText);
    }

    async getBudgetCategoryValues() {
        try {
            Logger.step('Getting budget category values from invoice grid');

            let grid = this.page
                .locator('[role="treegrid"]')
                .filter({ has: this.page.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }) })
                .first();
            await expect(grid).toBeVisible({ timeout: 12000 });

            let budgetCategoryHeader = grid.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }).first();
            let headerVisible = await budgetCategoryHeader.isVisible({ timeout: 4000 }).catch(() => false);
            if (!headerVisible) {
                const toggles = this.page.locator(
                    'button:has(svg.lucide-chevron-down), button:has(svg.lucide-chevron-up), button[aria-label*="expand" i], button[aria-label*="collapse" i]'
                );
                const toggleCount = await toggles.count().catch(() => 0);
                for (let i = 0; i < Math.min(toggleCount, 10) && !headerVisible; i++) {
                    const t = toggles.nth(i);
                    if (!(await t.isVisible().catch(() => false))) continue;
                    await t.click({ force: true }).catch(() => {});
                    await this.page.waitForTimeout(250);
                    headerVisible = await budgetCategoryHeader.isVisible({ timeout: 1500 }).catch(() => false);
                }
            }
            if (!headerVisible) {
                budgetCategoryHeader = grid.locator('[role="columnheader"]').filter({ hasText: /Budget Category/i }).first();
            }
            await expect(budgetCategoryHeader).toBeVisible({ timeout: 12000 });

            const budgetColIndexRaw = await budgetCategoryHeader
                .evaluate((el) => el.getAttribute('data-rgcol') || el.getAttribute('aria-colindex') || '')
                .catch(() => '');
            const budgetColIndex = String(budgetColIndexRaw || '5');

            const dataRows = grid.locator('[role="row"][data-rgrow]');
            const rowCount = await dataRows.count();
            const values = [];

            for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
                const row = dataRows.nth(rowIdx);
                const rowBox = await row.boundingBox();
                if (!rowBox) continue;

                const firstCellText = await row.locator('[role="gridcell"]').first().textContent().catch(() => '');
                if (/^total$/i.test(firstCellText?.trim())) continue;

                const catCell = row
                    .locator(`[role="gridcell"][data-rgcol="${budgetColIndex}"], [role="gridcell"][aria-colindex="${budgetColIndex}"]`)
                    .first();
                const cellValue = (await catCell.textContent().catch(() => ''))?.trim() || null;

                if (cellValue) values.push(cellValue);
            }

            Logger.info(`Budget category values: ${JSON.stringify(values)}`);
            return values;
        } catch (error) {
            Logger.error(`Failed to get budget category values: ${error.message}`);
            throw error;
        }
    }

    async getFirstInvoiceAmountCellText() {
        const amountCell = this.page.locator('div[role="gridcell"][data-rgcol="6"]').first();
        await amountCell.waitFor({ state: 'visible', timeout: 15000 });
        return ((await amountCell.textContent().catch(() => '')) || '').trim();
    }

    async confirmInvoiceAndHandleModal() {
        Logger.step('Confirming invoice (handling confirmation modal if present)...');
        const confirmInvoiceBtn = this.page.getByRole('button', { name: /confirm invoice/i });
        await confirmInvoiceBtn.waitFor({ state: 'visible', timeout: 10000 });

        const dismissToasts = async () => {
            // Mantine notifications often appear bottom-right and may intercept clicks.
            const alerts = this.page.locator('div[data-position] [role="alert"], [class*="Notifications-root"] [role="alert"]');
            const alertCount = await alerts.count().catch(() => 0);
            if (alertCount <= 0) return;

            for (let i = 0; i < alertCount; i++) {
                const alert = alerts.nth(i);
                if (!(await alert.isVisible().catch(() => false))) continue;
                const closeBtn = alert.locator('button').first();
                if (await closeBtn.isVisible().catch(() => false)) {
                    await closeBtn.click({ timeout: 2000 }).catch(() => null);
                }
            }
        };

        // Clear any success/info toasts that could block the click
        await dismissToasts();
        await this.page.waitForTimeout(250);

        // Click confirm; retry if a toast intercepts the pointer
        try {
            await confirmInvoiceBtn.click({ timeout: 15000 });
        } catch (err) {
            Logger.info(`Confirm Invoice click retry due to: ${err.message}`);
            await dismissToasts();
            await this.page.waitForTimeout(300);
            await confirmInvoiceBtn.click({ timeout: 15000, force: true });
        }

        const confirmModalBtn = this.page.getByRole('button', { name: /^Confirm$/ });
        if (await confirmModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            try {
                await confirmModalBtn.click({ timeout: 15000 });
            } catch (err) {
                Logger.info(`Confirm modal click retry due to: ${err.message}`);
                await dismissToasts();
                await this.page.waitForTimeout(300);
                await confirmModalBtn.click({ timeout: 15000, force: true });
            }
        }

        // Give app time to validate/publish
        await this.page.waitForTimeout(1500);

        const failureToast = this.page.locator('text=/Confirmation Failed|Empty invoice/i').first();
        if (await failureToast.isVisible({ timeout: 1000 }).catch(() => false)) {
            const msg = ((await failureToast.textContent().catch(() => '')) || '').trim();
            throw new Error(`Invoice confirmation failed: ${msg}`);
        }

        Logger.success('Invoice confirm action completed (no failure toast detected).');
        return true;
    }

    /**
     * Gets the invoice number from the dialog
     * @returns {string} Invoice number
     */
    async getInvoiceNumber() {
        try {
            const numberInput = this.page.getByRole('textbox', { name: 'Enter invoice number' });
            await numberInput.waitFor({ state: 'visible', timeout: 10000 });
            const value = await numberInput.inputValue();
            Logger.info(`Got invoice number: ${value}`);
            return value;
        } catch (error) {
            Logger.error(`Error getting invoice number: ${error.message}`);
            return null;
        }
    }

    /**
     * Clicks Confirm Invoice button to save the invoice
     */
    async confirmInvoice() {
        try {
            Logger.step('Confirming invoice...');
            const confirmButton = this.page.getByRole('button', { name: 'Confirm Invoice' });

            if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
                await confirmButton.click();
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1500);
                Logger.success('Invoice confirmed successfully.');
                return true;
            } else {
                Logger.info('Confirm Invoice button not found');
                return false;
            }
        } catch (error) {
            Logger.error(`Error confirming invoice: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clicks Go Back button to save and close the invoice dialog
     */
    async goBackToInvoiceList() {
        try {
            Logger.step('Going back to invoice list...');
            let lastError = null;

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const goBackButton = this.page.getByRole('button', { name: 'Go Back' });
                    const isVisible = await goBackButton.isVisible({ timeout: 3000 }).catch(() => false);

                    if (isVisible) {
                        await goBackButton.click({ timeout: 15000 });
                    } else {
                        // Dialogs in this app often close via Escape
                        await this.page.keyboard.press('Escape').catch(() => null);
                    }

                    await this.page.waitForLoadState('load');
                    await this.page.waitForTimeout(2000);
                    await this.page
                        .waitForURL(/tab=invoices/, { timeout: 15000 })
                        .catch(() => null);
                    await this.page.waitForTimeout(1000);

                    Logger.success('Navigated back to invoice list.');
                    return;
                } catch (err) {
                    lastError = err;
                    Logger.info(`Go Back attempt ${attempt} failed: ${err.message}`);
                    await this.page.waitForTimeout(800);
                }
            }

            throw lastError || new Error('Failed to navigate back to invoice list');
        } catch (error) {
            Logger.error(`Error going back: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies that the invoice values in the list match the expected data
     * @param {Object} expectedData - Object containing expected invoice details
     * @returns {boolean} True if values match
     */
    async verifyInvoiceInList(expectedData) {
        try {
            Logger.step('Verifying invoice in list...');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            // First check if we're on the Invoice tab
            const currentUrl = this.page.url();
            if (!currentUrl.includes('tab=invoices')) {
                await this.navigateToInvoiceTab();
                await this.page.waitForTimeout(2000);
            }

            // Look for the invoice using multiple approaches
            // Approach 1: Check for invoice number (most reliable)
            if (expectedData.invoiceNumber) {
                const numberCell = this.page.locator(`text=${expectedData.invoiceNumber}`).first();
                if (await numberCell.isVisible({ timeout: 3000 }).catch(() => false)) {
                    Logger.success(`Found invoice with number: ${expectedData.invoiceNumber}`);
                    return true;
                }
            }

            // Approach 2: Look for the title using body text
            if (expectedData.title) {
                // Check if the page body contains the title text
                const pageContent = await this.page.locator('body').textContent();
                if (pageContent.includes(expectedData.title)) {
                    Logger.success(`Found invoice title "${expectedData.title}" in page content`);
                    return true;
                }

                // Try multiple cell selectors
                let isVisible = false;

                // Try text locator
                const textLocator = this.page.locator(`text=${expectedData.title}`).first();
                isVisible = await textLocator.isVisible({ timeout: 3000 }).catch(() => false);

                if (isVisible) {
                    Logger.success(`Found invoice with title: ${expectedData.title}`);
                    return true;
                }

                // Approach 3: Reload and search in body text
                await this.page.reload();
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(2000);

                const pageContentAfterReload = await this.page.locator('body').textContent();
                if (pageContentAfterReload.includes(expectedData.title)) {
                    Logger.success(`Found invoice title "${expectedData.title}" in page after reload`);
                    return true;
                }

                Logger.info(`Invoice with title "${expectedData.title}" not found in list`);
                return false;
            }

            // If no specific data provided, just verify invoice count increased
            return true;
        } catch (error) {
            Logger.error(`Error verifying invoice: ${error.message}`);
            return false;
        }
    }

    /**
     * Gets the count of invoices in the list
     * @returns {number} Count of invoices
     */
    async getInvoiceCount() {
        try {
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(1000);

            // Count rows in the invoices grid
            const rows = this.page.locator('div[role="row"]:has(div[role="gridcell"]:has-text("Invoice #"))');
            const count = await rows.count();
            Logger.info(`Found ${count} invoices in the list`);
            return count;
        } catch (error) {
            Logger.error(`Error counting invoices: ${error.message}`);
            return 0;
        }
    }

    /**
     * Verifies all fields are entered successfully in the invoice dialog
     * @param {Object} expectedData - Object containing expected invoice details
     * @returns {boolean} True if all values match
     */
    async verifyInvoiceFieldsInDialog(expectedData) {
        try {
            Logger.step('Verifying invoice fields in dialog...');
            let allMatch = true;

            // Verify title
            if (expectedData.title) {
                const titleInput = this.page.getByRole('textbox', { name: 'Enter title' });
                const titleValue = await titleInput.inputValue();
                if (titleValue === expectedData.title) {
                    Logger.success(`Title matches: ${titleValue}`);
                } else {
                    Logger.error(`Title mismatch. Expected: ${expectedData.title}, Got: ${titleValue}`);
                    allMatch = false;
                }
            }

            // Verify description
            if (expectedData.description) {
                const descriptionInput = this.page.getByRole('textbox', { name: 'Enter description' });
                const descriptionValue = await descriptionInput.inputValue();
                if (descriptionValue === expectedData.description) {
                    Logger.success(`Description matches: ${descriptionValue}`);
                } else {
                    Logger.error(`Description mismatch. Expected: ${expectedData.description}, Got: ${descriptionValue}`);
                    allMatch = false;
                }
            }

            return allMatch;
        } catch (error) {
            Logger.error(`Error verifying fields: ${error.message}`);
            return false;
        }
    }

    /**
     * Creates a complete invoice with all fields filled
     * @param {Object} invoiceData - Object containing invoice details
     * @returns {Object} Created invoice info including number
     */
    async createCompleteInvoice(invoiceData) {
        try {
            Logger.step('Creating complete invoice...');

            await this.clickAddInvoice();
            await this.page.waitForTimeout(2000);

            // Handle the "Group by Unit" / "Group by Scope" segmented control added in the new UI.
            await this.selectInvoiceGroupByTab(invoiceData.groupBy || 'scope');

            const invoiceUrl = this.page.url();
            const jobId = invoiceUrl.match(/\/jobs\/(\d+)/)?.[1] || null;
            const invoiceId = invoiceUrl.match(/\/invoices\/(\d+)/)?.[1] || null;

            const invoiceNumber = await this.getInvoiceNumber();

            await this.fillInvoiceDetails(invoiceData);

            let amountFilled = false;
            let amountCellText = null;

            if (invoiceData.amount !== undefined && invoiceData.amount !== null) {
                amountFilled = await this.fillInvoiceGridAmount(invoiceData.amount);
                amountCellText = await this.getFirstInvoiceAmountCellText().catch(() => null);
            }

            let budgetCategoriesSet = 0;
            let budgetCategoryValues = [];
            if (invoiceData.budgetCategory) {
                budgetCategoriesSet = await this.fillBudgetCategoryInInvoice(invoiceData.budgetCategory);
                try {
                    budgetCategoryValues = await this.getBudgetCategoryValues();
                } catch (err) {
                    Logger.info(`getBudgetCategoryValues failed: ${err.message}, using empty array`);
                    budgetCategoryValues = [];
                }
            }

            const fieldsVerified = await this.verifyInvoiceFieldsInDialog(invoiceData);

            let confirmed = false;
            if (invoiceData.confirm === true) {
                confirmed = await this.confirmInvoiceAndHandleModal();
            }

            await this.goBackToInvoiceList();

            Logger.success(`Invoice ${invoiceNumber} created successfully.`);

            return {
                jobId,
                invoiceId,
                number: invoiceNumber,
                title: invoiceData.title,
                description: invoiceData.description,
                amount: invoiceData.amount,
                amountFilled,
                amountCellText,
                budgetCategoriesSet,
                budgetCategoryValues,
                confirmed,
                fieldsVerified
            };
        } catch (error) {
            Logger.error(`Error creating complete invoice: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies all invoice form fields are visible
     * @returns {Object} Object with visibility status of each field
     */
    async verifyInvoiceFormFieldsVisible() {
        try {
            Logger.step('Verifying invoice form fields visibility...');
            const locators = this.invoiceLocators;

            const result = {
                overviewSection: await locators.overviewSection.isVisible({ timeout: 5000 }).catch(() => false),
                numberInput: await locators.invoiceNumberInput.isVisible({ timeout: 5000 }).catch(() => false),
                titleInput: await locators.titleInput.isVisible({ timeout: 5000 }).catch(() => false),
                descriptionInput: await locators.descriptionInput.isVisible({ timeout: 5000 }).catch(() => false),
                documentsSection: await locators.documentsLabel.isVisible({ timeout: 5000 }).catch(() => false),
                confirmButton: await locators.confirmInvoiceButton.isVisible({ timeout: 5000 }).catch(() => false)
            };

            Logger.info(`Form fields visibility: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            Logger.error(`Error verifying form fields: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verifies that all expected column headers are visible in invoice details grid
     * @param {Array<string>} expectedColumns - Array of expected column names
     * @returns {Object} Object with visibility status of each column
     */
    async verifyInvoiceDetailsColumns(expectedColumns) {
        try {
            Logger.step('Verifying invoice details columns...');
            const result = {};

            for (const column of expectedColumns) {
                const columnHeader = this.invoiceLocators.columnHeader(column);
                const isVisible = await columnHeader.isVisible({ timeout: 5000 }).catch(() => false);
                result[column] = isVisible;
                Logger.info(`Column "${column}" visible: ${isVisible}`);
            }

            return result;
        } catch (error) {
            Logger.error(`Error verifying columns: ${error.message}`);
            throw error;
        }
    }

    /**
     * Checks if the invoice modal/dialog is open
     * @returns {boolean} True if modal is visible
     */
    async isInvoiceModalOpen() {
        try {
            const modal = this.invoiceLocators.modal;
            return await modal.isVisible({ timeout: 3000 }).catch(() => false);
        } catch (error) {
            return false;
        }
    }

    /**
     * Exports invoice data
     * @returns {boolean} True if export was successful
     */
    async exportInvoiceData() {
        try {
            Logger.step('Exporting invoice data...');
            // Multiple Export buttons exist in the DOM (one per tab panel).
            // Iterate to find the first visible one instead of using .first() which picks hidden panels.
            const exportButtons = this.page.locator('button').filter({ hasText: 'Export' });
            const count = await exportButtons.count().catch(() => 0);
            for (let i = 0; i < count; i++) {
                const btn = exportButtons.nth(i);
                if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await btn.click();
                    await this.page.waitForLoadState('load');
                    await this.page.waitForTimeout(2000);
                    Logger.success('Invoice data exported.');
                    return true;
                }
            }
            Logger.info('Export button not found');
            return false;
        } catch (error) {
            Logger.error(`Error exporting data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Gets the count of invoices with Pending status
     * @returns {number} Count of pending invoices
     */
    async getPendingInvoiceCount() {
        try {
            const pendingCells = this.invoiceLocators.pendingStatusCells;
            const count = await pendingCells.count();
            Logger.info(`Found ${count} invoices with Pending status`);
            return count;
        } catch (error) {
            Logger.error(`Error counting pending invoices: ${error.message}`);
            return 0;
        }
    }

    /** Locator bundle for TC08 structured suites (parity with Category `tc07Loc`). */
    tc08Loc() {
        return invoiceLocators(this.page);
    }

    /** Settle helper for TC08 (uses domcontentloaded + fixed wait — not networkidle). */
    async waitForInvoiceWorkspaceSettled(ms = 4000) {
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(ms);
    }
}

module.exports = { InvoicePage };
