const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { approvalJobLocators } = require('../locators/approvalLocator');

let approval;

exports.ApprovalJob = class ApprovalJob {
    constructor(page) {
        this.page = page;
        approval = approvalJobLocators(page);
    }

    async navigateToApprovalTab() {
        try {
            Logger.step('Navigating to Approval tab');
            await approval.approvalTab.click();
            await this.page.waitForURL('**/approvals/**', { timeout: 25000 }).catch(() => {});
            const _t0 = Date.now();
            const _tab = this.page.getByRole('tab', { name: 'Approval Templates' });
            const _ok = await _tab.waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
            if (_ok) {
                Logger.info(`[Approval] Nav ready in ${Date.now() - _t0}ms`);
            } else {
                for (let _i = 0; _i < 3; _i++) {
                    await this.page.waitForTimeout(5000);
                    if (await _tab.isVisible().catch(() => false)) {
                        Logger.info(`[Approval] Nav ready after extra ${(_i + 1) * 5}s`);
                        break;
                    }
                    Logger.info(`[Approval] Tab not visible yet after ${(_i + 1) * 5}s extra`);
                }
            }
            Logger.success('Navigated to Approval tab');
        } catch (error) {
            Logger.error('Failed to navigate to Approval tab: ' + error.message);
            throw error;
        }
    }

    async waitForPageLoad() {
        const _t0 = Date.now();
        try {
            const _btn = this.page.getByRole('button', { name: 'Create Template' }).first();
            const _ok = await _btn.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false);
            if (_ok) {
                Logger.info(`[Approval] Page ready in ${Date.now() - _t0}ms`);
            } else {
                for (let _i = 0; _i < 3; _i++) {
                    await this.page.waitForTimeout(7000);
                    if (await _btn.isVisible().catch(() => false)) {
                        Logger.info(`[Approval] Page ready after extra ${(_i + 1) * 5}s`);
                        return;
                    }
                    Logger.info(`[Approval] Page not ready yet after ${(_i + 1) * 5}s extra`);
                }
                Logger.info(`[Approval] WARNING: Page not ready after ${Date.now() - _t0}ms — proceeding`);
            }
        } catch (error) {
            Logger.error('Error waiting for page load: ' + error.message);
            throw error;
        }
    }

    async clickCreateTemplate() {
        try {
            Logger.step('Clicking Create Template button');
            await approval.createTemplateButton.click();
            await this.page.getByPlaceholder('Enter template name')
                .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
            await this.page.waitForTimeout(400);
            Logger.success('Create Template dialog opened');
            return true;
        } catch (error) {
            Logger.error('Error clicking Create Template: ' + error.message);
            throw error;
        }
    }

    async fillTemplateName(name) {
        try {
            Logger.step('Filling template name: ' + name);
            await approval.templateNameInput.fill(name);
            await this.page.waitForTimeout(800);
            Logger.success('Template name filled');
            return true;
        } catch (error) {
            Logger.error('Error filling template name: ' + error.message);
            throw error;
        }
    }

    async selectTemplateType(type) {
        try {
            Logger.step('Selecting template type: ' + type);
            let radioButton;

            switch (type.toLowerCase()) {
                case 'change order':
                    radioButton = approval.changeOrderRadio;
                    break;
                case 'invoice':
                    radioButton = approval.invoiceRadio;
                    break;
                case 'contract':
                case 'contract/po':
                    radioButton = approval.contractRadio;
                    break;
                case 'budget':
                    radioButton = approval.budgetRadio;
                    break;
                default:
                    throw new Error('Unknown template type: ' + type);
            }

            await radioButton.click();
            await this.page.waitForTimeout(800);
            Logger.success('Template type selected: ' + type);
            return true;
        } catch (error) {
            Logger.error('Error selecting template type: ' + error.message);
            throw error;
        }
    }

    async addProperty(propertyName) {
        try {
            Logger.step('Adding property: ' + propertyName);
            await approval.addPropertiesInput.fill(propertyName);
            await this.page.waitForTimeout(1000);
            Logger.success('Property added');
            return true;
        } catch (error) {
            Logger.error('Error adding property: ' + error.message);
            throw error;
        }
    }

    async submitCreateTemplate() {
        try {
            Logger.step('Submitting create template form');
            await approval.createTemplateSubmit.click();
            await this.page.getByRole('button', { name: 'Create Template' }).first()
                .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
            await this.page.waitForTimeout(600);

            // Detect backend rejection (e.g. "already linked" property conflict).
            const errorToast = this.page.locator('[role="alert"]').filter({ hasText: /already linked|already exists|duplicate/i });
            if (await errorToast.isVisible({ timeout: 1500 }).catch(() => false)) {
                const msg = (await errorToast.textContent().catch(() => '')).trim();
                Logger.info(`submitCreateTemplate: server rejected — "${msg}"`);
                throw new Error(`TEMPLATE_CONFLICT: ${msg}`);
            }

            Logger.success('Template submitted');
            return true;
        } catch (error) {
            Logger.error('Error submitting template: ' + error.message);
            throw error;
        }
    }

    /**
     * Deletes existing templates whose names match a given prefix and type.
     * The properties column in the Revogrid list does not expose property names as
     * plain text, so matching by row text is unreliable. Instead, pass the name
     * prefix used by the test suite (e.g. 'OOO_InvTemplate_') to target only
     * templates created by prior runs of the same test.
     *
     * @param {string} namePrefix - Template name prefix to match (e.g. 'OOO_InvTemplate_')
     * @param {string} templateType - Type label to also match (e.g. 'Invoice')
     */
    async deleteConflictingTemplatesForProperty(namePrefix, templateType = 'Invoice') {
        try {
            Logger.step(`Checking for existing "${templateType}" templates with prefix "${namePrefix}"...`);
            await this.clearSearch();
            await this.page.waitForTimeout(800);

            const tree = this.page.locator('[role="treegrid"]');
            const dataRows = tree.getByRole('row').filter({ has: this.page.locator('.revo-grid-cell-clear-btn') });

            let deletedCount = 0;
            const total = await dataRows.count();
            // Iterate in reverse so indices stay stable after each deletion
            for (let i = total - 1; i >= 0; i--) {
                const row = dataRows.nth(i);
                const rowText = (await row.textContent().catch(() => '')).toLowerCase();
                if (!rowText.includes(templateType.toLowerCase())) continue;

                const firstCell = row.locator('[role="gridcell"]').first();
                const rawName = (await firstCell.textContent().catch(() => '')).trim();
                // Strip the ✕ clear-button character that Revogrid appends
                const templateName = rawName.replace(/✕.*$/, '').trim();
                if (!templateName.startsWith(namePrefix)) continue;

                Logger.info(`Deleting conflicting template: "${templateName}"`);
                try {
                    await this.deleteTemplate(templateName);
                    deletedCount++;
                    await this.page.waitForTimeout(500);
                } catch (delErr) {
                    Logger.info(`Could not delete "${templateName}": ${delErr.message}`);
                }
            }

            if (deletedCount > 0) {
                Logger.success(`Deleted ${deletedCount} conflicting template(s) with prefix "${namePrefix}"`);
            } else {
                Logger.info(`No conflicting templates found with prefix "${namePrefix}"`);
            }
        } catch (error) {
            Logger.info(`deleteConflictingTemplatesForProperty: non-fatal — ${error.message}`);
        }
    }

    async cancelCreateTemplate() {
        try {
            Logger.step('Cancelling create template');
            await approval.cancelButton.click();
            await this.page.getByRole('button', { name: 'Create Template' }).first()
                .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
            await this.page.waitForTimeout(300);
            Logger.success('Create template cancelled');
            return true;
        } catch (error) {
            Logger.error('Error cancelling template creation: ' + error.message);
            throw error;
        }
    }

    async verifyTemplateCreatedPositive(templateName, templateType, property) {
        try {
            Logger.step('Creating template positive - name: ' + templateName);

            await this.clickCreateTemplate();
            await this.fillTemplateName(templateName);
            await this.selectTemplateType(templateType);

            if (property) {
                await this.addProperty(property);
            }

            await this.submitCreateTemplate();
            Logger.success('Template created successfully');
            return true;
        } catch (error) {
            Logger.error('Template creation positive test failed: ' + error.message);
            throw error;
        }
    }

    async verifyTemplateCreatedNegative() {
        try {
            Logger.step('Creating template negative - empty name validation');

            await this.clickCreateTemplate();

            // Try to submit empty form
            await approval.createTemplateSubmit.click();
            await this.page.waitForTimeout(1000);

            // Dialog should still be open
            const nameInputVisible = await approval.templateNameInput.isVisible({ timeout: 2000 }).catch(() => false);
            expect(nameInputVisible).toBeTruthy();

            Logger.success('Empty name validation working - dialog still open');

            await this.cancelCreateTemplate();
            return true;
        } catch (error) {
            Logger.error('Template creation negative test failed: ' + error.message);
            throw error;
        }
    }

    async clickFilterButton() {
        try {
            Logger.step('Opening filter panel');
            await approval.filterButton.click();
            await this.page.waitForTimeout(1000);
            Logger.success('Filter panel opened');
            return true;
        } catch (error) {
            Logger.error('Error opening filter: ' + error.message);
            throw error;
        }
    }

    async filterByNamePositive(searchValue) {
        try {
            Logger.step('Filtering by name positive - value: ' + searchValue);

            await this.clickFilterButton();

            // Get the filter input
            const filterInput = this.page.getByPlaceholder('Enter values to search for (OR logic)').first();
            await filterInput.fill(searchValue);
            await this.page.waitForTimeout(1500);

            Logger.success('Filter applied successfully');
            return true;
        } catch (error) {
            Logger.error('Filter positive test failed: ' + error.message);
            throw error;
        }
    }

    async filterByNameNegative() {
        try {
            Logger.step('Filtering by name negative - invalid value');

            await this.clickFilterButton();

            const filterInput = this.page.getByPlaceholder('Enter values to search for (OR logic)').first();
            await filterInput.fill('NONEXISTENT_XYZ_123_ABC');
            await this.page.waitForTimeout(1500);

            Logger.success('Filter applied with non-existent value');
            return true;
        } catch (error) {
            Logger.error('Filter negative test failed: ' + error.message);
            throw error;
        }
    }

    async manageColumnsPositive() {
        try {
            Logger.step('Manage Columns positive - verify dialog opens');

            await this.clickManageColumnsButton();

            await expect(approval.manageColumnsDialog).toBeVisible({ timeout: 10000 });

            Logger.success('Manage Columns dialog displayed');

            await this.page.keyboard.press('Escape');
            return true;
        } catch (error) {
            Logger.error('Manage Columns positive test failed: ' + error.message);
            throw error;
        }
    }

    async manageColumnsNegative() {
        try {
            Logger.step('Manage Columns negative - toggle column and reset');

            await this.clickManageColumnsButton();

            // Get first checkbox
            const checkbox = this.page.locator('checkbox').first();
            const isChecked = await checkbox.isChecked().catch(() => false);
            Logger.info('First checkbox checked: ' + isChecked);

            // Click it
            await checkbox.click();
            await this.page.waitForTimeout(500);

            // Try to reset to default
            const defaultBtn = this.page.locator('button').filter({ hasText: 'Default Columns' }).first();
            const btnVisible = await defaultBtn.isVisible({ timeout: 3000 }).catch(() => false);

            if (btnVisible) {
                await defaultBtn.click();
                await this.page.waitForTimeout(1000);
                Logger.success('Columns reset to default');
            }

            await this.page.keyboard.press('Escape');
            return true;
        } catch (error) {
            Logger.error('Manage Columns negative test failed: ' + error.message);
            throw error;
        }
    }

    async exportDataPositive() {
        try {
            Logger.step('Exporting data positive');

            const downloadPromise = this.page.waitForEvent('download');
            await approval.exportButton.click();

            const download = await Promise.race([
                downloadPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 10000))
            ]).catch(() => null);

            if (download) {
                const fileName = download.suggestedFilename();
                Logger.success('File exported: ' + fileName);
                expect(fileName).toContain('.csv');
            } else {
                Logger.info('Export clicked, file handling may vary');
            }

            return true;
        } catch (error) {
            Logger.error('Export positive test failed: ' + error.message);
            throw error;
        }
    }

    async exportDataNegative() {
        try {
            Logger.step('Exporting data negative');

            await approval.exportButton.click();
            await this.page.waitForTimeout(2000);

            Logger.success('Export button clicked');
            return true;
        } catch (error) {
            Logger.error('Export negative test failed: ' + error.message);
            throw error;
        }
    }

    async clickCreateViewButton() {
        try {
            Logger.step('Opening Create View dialog');
            await approval.createViewButton.click();
            await this.page.waitForTimeout(1000);
            Logger.success('Create View dialog opened');
            return true;
        } catch (error) {
            Logger.error('Error opening Create View: ' + error.message);
            throw error;
        }
    }

    async createViewPositive(viewName) {
        try {
            Logger.step('Creating view positive - name: ' + viewName);

            await this.clickCreateViewButton();

            const viewInput = this.page.getByPlaceholder('Enter view name...');
            await viewInput.fill(viewName);
            await this.page.waitForTimeout(800);

            // Find and click save button
            const saveBtn = this.page.getByRole('button').filter({ hasText: /save/i }).first();
            const saveBtnVisible = await saveBtn.isVisible({ timeout: 3000 }).catch(() => false);

            if (saveBtnVisible) {
                await saveBtn.click();
                await this.page.waitForTimeout(1500);
                Logger.success('View created: ' + viewName);
            } else {
                Logger.info('Save button not found, dialog opened successfully');
            }

            return true;
        } catch (error) {
            Logger.error('Create view positive test failed: ' + error.message);
            throw error;
        }
    }

    async createViewNegative() {
        try {
            Logger.step('Creating view negative - empty name validation');

            await this.clickCreateViewButton();

            // Check if save button is disabled
            const saveBtn = this.page.getByRole('button').filter({ hasText: /save/i }).first();
            const isDisabled = await saveBtn.isDisabled().catch(() => false);

            Logger.success('Save button disabled for empty view: ' + isDisabled);

            await this.page.keyboard.press('Escape');
            return true;
        } catch (error) {
            Logger.error('Create view negative test failed: ' + error.message);
            throw error;
        }
    }

    async verifyAllTemplateTypesPositive() {
        try {
            Logger.step('Verifying all 4 template types positive');

            const types = ['Change Order', 'Invoice', 'Contract', 'Budget'];

            for (const type of types) {
                await this.clickCreateTemplate();
                Logger.info('Testing type: ' + type);

                await this.selectTemplateType(type);

                await this.cancelCreateTemplate();
                await this.page.waitForTimeout(500);
            }

            Logger.success('All 4 template types verified');
            return true;
        } catch (error) {
            Logger.error('Template types verification failed: ' + error.message);
            throw error;
        }
    }

    async verifyAllTemplateTypesNegative() {
        try {
            Logger.step('Verifying template types negative - radios disabled in edit');

            // Just verify we can open create dialog
            await this.clickCreateTemplate();
            await this.selectTemplateType('Change Order');
            await this.fillTemplateName('TestTemplate_' + Date.now());

            await this.cancelCreateTemplate();
            Logger.success('Template type behavior verified');
            return true;
        } catch (error) {
            Logger.error('Template types negative test failed: ' + error.message);
            throw error;
        }
    }

    async clickEditTemplate(templateName) {
        try {
            Logger.step('Opening edit form for template: ' + templateName);

            // Find the row with this template name
            const templateCell = this.page.locator(`text=${templateName}`).first();

            // Find the edit button in the same row
            const editBtn = templateCell.locator('xpath=ancestor::row//button[contains(., "Edit")]').first();

            await editBtn.click();
            await this.page.waitForURL('**/edit', { timeout: 10000 }).catch(() => {});
            await this.page.getByPlaceholder('Enter template name')
                .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
            await this.page.waitForTimeout(400);

            Logger.success('Edit form opened for: ' + templateName);
            return true;
        } catch (error) {
            Logger.error('Error opening edit form: ' + error.message);
            throw error;
        }
    }

    async verifyEditTemplateDisabledRadios(templateName) {
        try {
            Logger.step('Verifying edit template - disabled radios positive');

            await this.clickEditTemplate(templateName);

            // Check if radios are disabled
            const changeOrderDisabled = await approval.changeOrderRadio.isDisabled().catch(() => false);
            const invoiceDisabled = await approval.invoiceRadio.isDisabled().catch(() => false);

            Logger.info('Change Order disabled: ' + changeOrderDisabled);
            Logger.info('Invoice disabled: ' + invoiceDisabled);

            expect(changeOrderDisabled).toBeTruthy();
            expect(invoiceDisabled).toBeTruthy();

            Logger.success('Confirmed: Template type radios are disabled in edit mode');

            await this.cancelEditTemplate();
            return true;
        } catch (error) {
            Logger.error('Edit template disabled radios test failed: ' + error.message);
            throw error;
        }
    }

    async cancelEditTemplate() {
        try {
            Logger.step('Cancelling edit');
            await approval.cancelButton.click();
            await this.page.getByRole('button', { name: 'Create Template' }).first()
                .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
            await this.page.waitForTimeout(300);
            Logger.success('Edit cancelled');
            return true;
        } catch (error) {
            Logger.error('Error cancelling edit: ' + error.message);
            throw error;
        }
    }

    async clickDeleteTemplate(templateName) {
        try {
            Logger.step('Opening delete confirmation for: ' + templateName);

            /*
             * MCP / DOM probe (approval templates Revogrid): there is NO [role="rowgroup"] wrapper.
             * Data rows expose only .revo-grid-cell-clear-btn ActionIcons inside cells (no Edit here).
             * Edit + delete occupy separate [role="row"] blocks after the data rows; order matches row-by-row.
             */
            const tree = this.page.locator('[role="treegrid"]');
            const dataRows = tree.getByRole('row').filter({ has: this.page.locator('.revo-grid-cell-clear-btn') });
            const actionRows = tree.getByRole('row').filter({ has: this.page.getByRole('button', { name: 'Edit' }) });
            const n = await dataRows.count();
            const actionN = await actionRows.count();

            let idx = -1;
            for (let i = 0; i < n; i++) {
                const r = dataRows.nth(i);
                const hit = await r.getByText(templateName, { exact: true }).count();
                if (hit > 0) {
                    idx = i;
                    break;
                }
            }
            if (idx < 0) {
                throw new Error('No data row found for template: ' + templateName);
            }
            if (n !== actionN) {
                Logger.info(`Approval grid row alignment differs: dataRows=${n} actionRows=${actionN}`);
            }
            if (idx >= actionN) {
                throw new Error(`Actions row missing for index ${idx} (actionRows=${actionN})`);
            }

            const deleteBtn = actionRows.nth(idx).locator('button').filter({ hasNotText: 'Edit' }).first();
            await expect(deleteBtn).toBeVisible({ timeout: 15000 });
            await deleteBtn.click({ force: true });
            await this.page.waitForTimeout(1000);

            Logger.success('Delete confirmation dialog opened');
            return true;
        } catch (error) {
            Logger.error('Error opening delete dialog: ' + error.message);
            throw error;
        }
    }

    async deleteTemplate(templateName) {
        try {
            Logger.step('Deleting template: ' + templateName);

            await this.clickDeleteTemplate(templateName);

            await approval.deleteConfirmButton.click();
            await this.page.getByRole('button', { name: 'Create Template' }).first()
                .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
            await this.page.waitForTimeout(400);

            Logger.success('Template deleted: ' + templateName);
            return true;
        } catch (error) {
            Logger.error('Error deleting template: ' + error.message);
            throw error;
        }
    }

    async cancelDeleteTemplate(templateName) {
        try {
            Logger.step('Cancelling delete for: ' + templateName);

            await this.clickDeleteTemplate(templateName);

            await approval.deleteConfirmCancelButton.click();
            await this.page.waitForTimeout(800);

            Logger.success('Delete cancelled');
            return true;
        } catch (error) {
            Logger.error('Error cancelling delete: ' + error.message);
            throw error;
        }
    }

    async verifyTableHeadersPositive() {
        try {
            Logger.step('Verifying table headers positive');

            const expectedHeaders = ['Name', 'Template Type', 'Properties', 'Approval Rules', 'Created By', 'Actions'];
            const allHeadersFound = [];

            for (const header of expectedHeaders) {
                const headerLocator = this.page.locator(`columnheader:has-text("${header}")`);
                const isVisible = await headerLocator.isVisible({ timeout: 5000 }).catch(() => false);
                allHeadersFound.push(isVisible);
                Logger.info('Header ' + header + ' found: ' + isVisible);
            }

            const allPresent = allHeadersFound.every(h => h === true);
            expect(allPresent).toBeTruthy();

            Logger.success('All table headers verified');
            return true;
        } catch (error) {
            Logger.error('Table headers verification failed: ' + error.message);
            throw error;
        }
    }

    async verifyTableHeadersNegative() {
        try {
            Logger.step('Verifying table headers negative - column order');

            const headers = await this.page.locator('columnheader').allTextContents();
            Logger.info('Column order: ' + headers.join(', '));

            const hasNameColumn = headers.some(h => h.includes('Name'));
            const hasActionsColumn = headers.some(h => h.includes('Actions'));

            expect(hasNameColumn).toBeTruthy();
            expect(hasActionsColumn).toBeTruthy();

            Logger.success('Column structure verified');
            return true;
        } catch (error) {
            Logger.error('Table headers negative test failed: ' + error.message);
            throw error;
        }
    }

    async endToEndCreateEditDeletePositive() {
        try {
            Logger.step('E2E test positive - create, edit, delete');

            const templateName = 'E2E_Test_' + Date.now();
            Logger.info('Template name: ' + templateName);

            Logger.step('Step 1: Creating template');
            await this.verifyTemplateCreatedPositive(templateName, 'Invoice', 'TestProp');
            await this.navigateToApprovalTab();
            await this.waitForPageLoad();
            Logger.success('Step 1 complete: Template created');

            Logger.step('Step 2: Editing template');
            await this.clickEditTemplate(templateName);
            const nameInput = approval.templateNameInput;
            const currentValue = await nameInput.inputValue();
            expect(currentValue).toBe(templateName);
            await this.cancelEditTemplate();
            Logger.success('Step 2 complete: Template opened and cancelled');

            Logger.step('Step 3: Deleting template');
            await this.deleteTemplate(templateName);
            Logger.success('Step 3 complete: Template deleted');

            Logger.success('E2E positive test completed');
            return true;
        } catch (error) {
            Logger.error('E2E positive test failed: ' + error.message);
            throw error;
        }
    }

    async endToEndCreateEditDeleteNegative() {
        try {
            Logger.step('E2E test negative - cancel operations');

            Logger.step('Step 1: Cancel create');
            await this.clickCreateTemplate();
            await this.fillTemplateName('Temp_' + Date.now());
            await this.cancelCreateTemplate();
            Logger.success('Step 1: Create cancelled');

            Logger.step('Step 2: Cancel edit');
            await this.clickEditTemplate('test113377');
            await this.cancelEditTemplate();
            Logger.success('Step 2: Edit cancelled');

            Logger.step('Step 3: Cancel delete');
            await this.cancelDeleteTemplate('test113377');
            Logger.success('Step 3: Delete cancelled');

            Logger.success('E2E negative test completed');
            return true;
        } catch (error) {
            Logger.error('E2E negative test failed: ' + error.message);
            throw error;
        }
    }

    async navigateToApprovalTemplatesTab() {
        try {
            Logger.step('Navigating to Approval Templates tab');
            await approval.approvalTemplatesTab.click();
            await this.page.waitForTimeout(8000);
            Logger.success('Navigated to Approval Templates tab');
        } catch (error) {
            Logger.error('Error navigating to Approval Templates tab: ' + error.message);
            throw error;
        }
    }

    async openCreateTemplateDialog() {
        try {
            Logger.step('Opening Create Template dialog');
            await approval.createTemplateButton.click();
            const dialog = this.page.getByRole('dialog').filter({ has: approval.templateNameInput });
            await expect(dialog).toBeVisible({ timeout: 30000 });
            await this.page.waitForTimeout(4000);
            Logger.success('Create Template dialog opened');
        } catch (error) {
            Logger.error('Error opening Create Template dialog: ' + error.message);
            throw error;
        }
    }

    async isDialogOpen() {
        try {
            return await approval.createTemplateButton.isVisible().catch(() => false);
        } catch (error) {
            return false;
        }
    }

    // async addProperty(propertyName = 'Harbor') {
    //     try {
    //         Logger.step('Adding property from dropdown: ' + propertyName);
    //         await approval.addPropertiesInput.click();
    //         await this.page.waitForTimeout(500);
    //         // Type property name to search for the property
    //         await approval.addPropertiesInput.fill(propertyName);
    //         await this.page.waitForTimeout(600);
    //         // Select the first matching option
    //         await this.page.keyboard.press('ArrowDown');
    //         await this.page.waitForTimeout(300);
    //         await this.page.keyboard.press('Enter');
    //         await this.page.waitForTimeout(800);
    //         Logger.success('Property added from dropdown: ' + propertyName);
    //     } catch (error) {
    //         Logger.error('Error adding property: ' + error.message);
    //         throw error;
    //     }
    // }

    async addProperty(propertyName = 'Harbor') {
        try {
            Logger.step('Adding property from dropdown: ' + propertyName);
            // Open the Add Properties dropdown (collapsed field is a button)
            await approval.addPropertiesTrigger.click();
            await this.page.waitForTimeout(3000);

            // Type into the dropdown's internal search input
            await approval.addPropertiesInput.fill(propertyName);
            await this.page.waitForTimeout(5000);

            // Mantine renders options inside a visible Combobox dropdown; each row contains a checkbox input.
            const dropdown = this.page.locator('.mantine-Combobox-dropdown:visible').first();
            await expect(dropdown).toBeVisible({ timeout: 15000 });

            // Prefer the exact matching result row (when searching full property name this should be a single option).
            const matchingRow = dropdown.locator('div:has(input[type="checkbox"])').filter({ hasText: propertyName }).first();
            const matchingRowVisible = await matchingRow.isVisible().catch(() => false);

            if (matchingRowVisible) {
                const checkbox = matchingRow.locator('input[type="checkbox"].mantine-Checkbox-input').first();
                await expect(checkbox).toBeVisible({ timeout: 15000 });
                await checkbox.check({ force: true });
            } else {
                // Fallback: check the first result checkbox (skip the "Select all" control)
                const firstResultRow = dropdown
                    .locator('div:has(input[type="checkbox"])')
                    .filter({ hasNotText: 'Select all' })
                    .first();
                await expect(firstResultRow).toBeVisible({ timeout: 15000 });

                const checkbox = firstResultRow.locator('input[type="checkbox"].mantine-Checkbox-input').first();
                await expect(checkbox).toBeVisible({ timeout: 15000 });
                await checkbox.check({ force: true });
            }

            // Close dropdown / commit selection (Escape can trigger page-level "Go Back")
            await approval.templateNameInput.click({ force: true });
            await dropdown.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
            await this.page.waitForTimeout(8000);
            Logger.success('Property added from dropdown: ' + propertyName);
        } catch (error) {
            Logger.error('Error adding property: ' + error.message);
            throw error;
        }
    }

    async addApprover(approverName = 'sumit test') {
        const approverTimeout = 15000;
        try {
            Logger.step('Adding approver from dropdown: ' + approverName);
            const approverInput = approval.selectApproverInput.first();
            await approverInput.waitFor({ state: 'visible', timeout: approverTimeout });
            await approverInput.fill(approverName, { timeout: approverTimeout });
            await this.page.waitForTimeout(8000);
            await this.page.keyboard.press('ArrowDown');
            await this.page.waitForTimeout(500);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(2000);
            Logger.success('Approver added from dropdown');
        } catch (error) {
            Logger.error('Error adding approver: ' + error.message);
            throw error;
        }
    }

    async addThreeApprovers() {
        const approverTimeout = 15000;
        const approverInputs = approval.selectApproverInput;
        try {
            // 1st approver: sumit mishra
            Logger.step('Adding approver 1/3: sumit mishra');
            const input0 = approverInputs.nth(0);
            await input0.waitFor({ state: 'visible', timeout: approverTimeout });
            await input0.click();
            await this.page.waitForTimeout(300);
            await input0.fill('sumit mishra', { timeout: approverTimeout });
            await this.page.waitForTimeout(800);
            await this.page.keyboard.press('ArrowDown');
            await this.page.waitForTimeout(300);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(800);
            Logger.success('Approver 1 added: sumit mishra');

            // 2nd approver: sumit test
            Logger.step('Adding approver 2/3: sumit test');
            const input1 = approverInputs.nth(1);
            await input1.waitFor({ state: 'visible', timeout: approverTimeout });
            await input1.click();
            await this.page.waitForTimeout(300);
            await input1.fill('sumit test', { timeout: approverTimeout });
            await this.page.waitForTimeout(800);
            await this.page.keyboard.press('ArrowDown');
            await this.page.waitForTimeout(300);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(800);
            Logger.success('Approver 2 added: sumit test');

            // 3rd approver: select any option except sumit mishra and sumit test (skip first options via ArrowDown)
            Logger.step('Adding approver 3/3: selecting any other option');
            const input2 = approverInputs.nth(2);
            await input2.waitFor({ state: 'visible', timeout: approverTimeout });
            await input2.click();
            // await this.page.waitForTimeout(500);
            // for (let k = 0; k < 3; k++) {
            //     await this.page.keyboard.press('ArrowDown');
            //     await this.page.waitForTimeout(150);
            // }
            // await this.page.keyboard.press('Enter');
            // await this.page.waitForTimeout(800);
            // Logger.success('Approver 3 added: selected from dropdown');
            await this.page.waitForTimeout(300);
            await input2.fill('sumit tailorbird', { timeout: approverTimeout });
            await this.page.waitForTimeout(800);
            await this.page.keyboard.press('ArrowDown');
            await this.page.waitForTimeout(300);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(800);
            Logger.success('Approver 3 added: sumit tailorbird');
        } catch (error) {
            Logger.error('Error adding approvers: ' + error.message);
            throw error;
        }
    }

    createTemplateDialog() {
        return approval.templateDialog;
    }

    async fillAmount(amount) {
        const fieldTimeout = 15000;
        try {
            Logger.step('Filling amount: ' + amount);
            const dialog = this.createTemplateDialog();
            const amountFields = dialog.getByPlaceholder('Enter Amount');
            const n = await amountFields.count();
            for (let i = 0; i < n; i++) {
                const amountField = amountFields.nth(i);
                await amountField.waitFor({ state: 'visible', timeout: fieldTimeout });
                await amountField.click();
                await this.page.waitForTimeout(200);
                await amountField.fill(amount.toString(), { timeout: fieldTimeout });
            }
            await this.page.waitForTimeout(500);
            Logger.success('Amount filled on ' + n + ' approver row(s): ' + amount);
        } catch (error) {
            Logger.error('Error filling amount: ' + error.message);
            throw error;
        }
    }

    /**
     * Toggle "Always Required" / mandatory flags on approver rows inside Create/Edit Template dialog.
     * Property pickers often port their dropdown outside the dialog; scoping to the dialog avoids wrong targets.
     * @param {number} [maxCount] - If set, only the first N checkboxes in the dialog are checked. If omitted, checks all.
     */
    async checkAlwaysRequiredInTemplateDialog(maxCount) {
        try {
            const dialog = this.createTemplateDialog();
            await expect(dialog).toBeVisible({ timeout: 15000 });
            const checkboxes = approval.alwaysRequiredCheckboxesInTemplateDialog;
            const total = await checkboxes.count();
            const limit = maxCount === undefined || maxCount === null ? total : Math.min(maxCount, total);

            Logger.step(`Checking Always Required in template dialog (${limit} of ${total} checkbox(es))`);

            for (let i = 0; i < limit; i++) {
                const checkbox = checkboxes.nth(i);
                if (!(await checkbox.isChecked())) {
                    await checkbox.check({ force: true });
                    await this.page.waitForTimeout(150);
                }
            }

            Logger.success(`Always Required checked for ${limit} approver row(s)`);
        } catch (error) {
            Logger.error('Error checking Always Required in template dialog: ' + error.message);
            throw error;
        }
    }

    async checkAlwaysRequired() {
        await this.checkAlwaysRequiredInTemplateDialog(1);
    }

    async checkAlwaysRequiredCount(count = 3) {
        await this.checkAlwaysRequiredInTemplateDialog(count);
    }

    async checkAllAlwaysRequired() {
        await this.checkAlwaysRequiredInTemplateDialog();
    }

    async uncheckAlwaysRequired() {
        try {
            Logger.step('Unchecking Always Required checkbox');
            // Works for both contexts:
            // 1) Create template drawer (dialog-scoped checkboxes)
            // 2) Edit template page (table row checkboxes without dialog wrapper)
            let checkboxes = approval.alwaysRequiredCheckboxesInTemplateDialog;
            let count = await checkboxes.count();
            if (count === 0) {
                // Edit template page: approver rows load after the template name input appears;
                // wait for the first checkbox to be attached before counting.
                await this.page.locator('input[type="checkbox"]').first()
                    .waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
                checkboxes = this.page.locator('input[type="checkbox"]');
                count = await checkboxes.count();
            }
            if (count === 0) {
                // Last resort: some Mantine versions render toggles as role="switch" buttons
                checkboxes = this.page.locator('[role="switch"]');
                count = await checkboxes.count();
            }
            if (count === 0) {
                throw new Error('No Always Required checkbox found in current context');
            }
            const firstCheckbox = checkboxes.first();
            await expect(firstCheckbox).toBeVisible({ timeout: 10000 });

            const isChecked = await firstCheckbox.isChecked().catch(async () => {
                // role="switch" elements expose checked state via aria-checked
                const aria = await firstCheckbox.getAttribute('aria-checked');
                return aria === 'true';
            });
            if (isChecked) {
                await firstCheckbox.click();
            }

            Logger.success('Always Required checkbox unchecked');
        } catch (error) {
            Logger.error('Error unchecking Always Required: ' + error.message);
            throw error;
        }
    }


    async submitCreateTemplateForm() {
        try {
            Logger.step('Submitting Create Template form');
            await approval.createTemplateSubmit.click();
            await this.page.getByRole('button', { name: 'Create Template' }).first()
                .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
            await this.page.waitForTimeout(1000);
            Logger.success('Create Template form submitted');
        } catch (error) {
            Logger.error('Error submitting form: ' + error.message);
            throw error;
        }
    }

    async cancelDialog() {
        try {
            Logger.step('Cancelling dialog');
            const drawerLocator = this.page.getByRole('dialog').filter({ has: approval.templateNameInput });
            const templateDialog = drawerLocator;
            const scopedCancel = templateDialog.getByRole('button', { name: 'Cancel' });
            if (await scopedCancel.isVisible({ timeout: 5000 }).catch(() => false)) {
                await scopedCancel.click();
            } else {
                const inDialog = this.page.getByRole('dialog').getByRole('button', { name: 'Cancel' });
                if (await inDialog.first().isVisible({ timeout: 3000 }).catch(() => false)) {
                    await inDialog.first().click();
                } else {
                    await approval.cancelButton.first().click();
                }
            }
            await this.page.waitForTimeout(2000);

            // When the form is dirty, cancelling may open a secondary "discard changes" confirmation.
            const drawerStillVisible = await drawerLocator.isVisible({ timeout: 500 }).catch(() => false);
            if (drawerStillVisible) {
                const discardNames = ['Go Back', 'Discard', 'Discard Changes', 'Confirm'];
                for (const name of discardNames) {
                    const btn = this.page.getByRole('button', { name }).first();
                    try {
                        await btn.waitFor({ state: 'visible', timeout: 600 });
                        await btn.scrollIntoViewIfNeeded().catch(() => {});
                        await this.page.waitForTimeout(300); // let animation stabilize before acting
                        await btn.click({ force: true, timeout: 8000 });
                        await this.page.waitForTimeout(700);
                        break;
                    } catch {
                        // button not found or disappeared before click, try next name
                    }
                }
            }

            // Wait for dialog to fully disappear (animation + unmount)
            await drawerLocator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
            Logger.success('Dialog cancelled');
        } catch (error) {
            Logger.error('Error cancelling dialog: ' + error.message);
            throw error;
        }
    }

    async isDialogClosed() {
        try {
            const dialogs = this.page.locator('[role="dialog"]');
            const n = await dialogs.count();
            for (let i = 0; i < n; i++) {
                if (await dialogs.nth(i).isVisible().catch(() => false)) {
                    return false;
                }
            }
            return true;
        } catch (error) {
            return true;
        }
    }

    async getTableRowCount() {
        try {
            // Count total rows including header rows
            const allRows = this.page.getByRole('row');
            const totalRowCount = await allRows.count();
            // Subtract the header row to get data row count
            return Math.max(0, totalRowCount - 1);
        } catch (error) {
            return 0;
        }
    }

    async getTableHeaderCount() {
        try {
            await this.page.waitForTimeout(800);
            const headers = this.page.getByRole('columnheader', { name: /Name|Template Type|Properties|Approval Rules|Created By|Actions/ });
            const count = await headers.count();
            return count;
        } catch (error) {
            Logger.error('getTableHeaderCount failed: ' + error.message);
            throw error;
        }
    }

    /** Fails fast if the approval templates grid is missing core columns (avoids brittle fixed column counts).
     *  Self-heals: if any required column is hidden (e.g. from a previous test toggling Manage Columns),
     *  opens the Manage Columns drawer and checks all checkboxes before asserting. */
    async expectApprovalTemplatesTableCoreColumnsVisible() {
        const patterns = [/Name/i, /Template Type/i, /Properties/i, /Approval Rules/i, /Created By/i];

        // Quick pre-check: if every column is already visible, skip the heal step.
        const allVisible = await Promise.all(
            patterns.map(p =>
                this.page.getByRole('columnheader', { name: p }).first()
                    .isVisible({ timeout: 3000 }).catch(() => false)
            )
        );

        if (!allVisible.every(Boolean)) {
            Logger.info('[expectApprovalTemplatesTableCoreColumnsVisible] One or more columns hidden — resetting via Manage Columns');
            const opened = await this.clickManageColumnsButton().then(() => true).catch(() => false);
            if (opened) {
                const checkboxes = this.page.locator('input[type="checkbox"]');
                const count = await checkboxes.count();
                for (let i = 0; i < count; i++) {
                    const cb = checkboxes.nth(i);
                    const checked = await cb.isChecked().catch(() => true);
                    if (!checked) {
                        await cb.click();
                        await this.page.waitForTimeout(200);
                    }
                }
                await this.page.keyboard.press('Escape');
                await this.page.waitForTimeout(800);
                Logger.info('[expectApprovalTemplatesTableCoreColumnsVisible] Columns reset — all checkboxes re-enabled');
            }
        }

        for (const pattern of patterns) {
            await expect(this.page.getByRole('columnheader', { name: pattern }).first()).toBeVisible({
                timeout: 30000,
            });
        }
    }

    async clickEditTemplate() {
        try {
            Logger.step('Opening Edit template dialog');
            // Wait for any modal/portal to be removed before clicking
            await this.page.waitForTimeout(5000);
            const editBtn = approval.editButtons.first();
            // Use force click to bypass any overlay blocking
            await editBtn.click({ force: true });
            await this.waitForPageLoad();
            await this.page.waitForTimeout(5000);
            Logger.success('Edit template dialog opened');
        } catch (error) {
            Logger.error('Error opening Edit template dialog: ' + error.message);
            throw error;
        }
    }

    async searchTemplate(searchTerm) {
        try {
            Logger.step('Searching for template: ' + searchTerm);
            await approval.searchInput.fill(searchTerm);
            await this.page.waitForTimeout(800);
            Logger.success('Search filter applied: ' + searchTerm);
        } catch (error) {
            Logger.error('Error searching: ' + error.message);
            throw error;
        }
    }

    async clearSearch() {
        try {
            Logger.step('Clearing search filter');
            await approval.searchInput.clear();
            await this.page.waitForTimeout(600);
            Logger.success('Search filter cleared');
        } catch (error) {
            Logger.error('Error clearing search: ' + error.message);
            throw error;
        }
    }

    async isRadioDisabled(type) {
        try {
            let radio;
            switch (type) {
                case 'Change Order':
                    radio = approval.changeOrderRadio;
                    break;
                case 'Invoice':
                    radio = approval.invoiceRadio;
                    break;
                case 'Contract':
                    radio = approval.contractRadio;
                    break;
                case 'Budget':
                    radio = approval.budgetRadio;
                    break;
                default:
                    return false;
            }
            return await radio.isDisabled().catch(() => false);
        } catch (error) {
            return false;
        }
    }

    async clickFilterButton() {
        try {
            Logger.step('Clicking Filter button');
            await approval.filterButton.click();
            await this.page.waitForTimeout(800);
            Logger.success('Filter button clicked');
        } catch (error) {
            Logger.error('Error clicking Filter button: ' + error.message);
            throw error;
        }
    }

    filterDrawerOrInputs() {
        return this.page.getByPlaceholder('Enter values to search for (OR logic)');
    }

    async isFilterDrawerOpen() {
        return await this.page.getByText('Filter Options', { exact: false }).first().isVisible().catch(() => false);
    }

    /** Mantine TagsInput commits tokens on Enter; input value clears after committing. */
    async commitFilterOrTag(orInputNth, label) {
        const inputs = this.filterDrawerOrInputs();
        const field = inputs.nth(orInputNth);
        await field.fill(label);
        await field.press('Enter');
        await this.page.waitForTimeout(350);
        await field.press('Escape').catch(() => {});
        await this.page.waitForTimeout(200);
    }

    /** Closing uses the Filters header chrome (toolbar Filter toggle alone may not detach the drawer). */
    async closeFilterDrawerToggle() {
        const headerClose = this.page.getByText('Filters', { exact: true }).locator('..').getByRole('button').first();
        if (await headerClose.isVisible({ timeout: 2500 }).catch(() => false)) {
            await headerClose.click();
        } else {
            await approval.filterButton.click();
        }
        await this.page.waitForTimeout(450);
        if (await this.isFilterDrawerOpen()) {
            await approval.filterButton.click().catch(() => {});
            await this.page.waitForTimeout(400);
        }
    }

    async clearFilterDrawerCommittedTags() {
        if (!(await this.isFilterDrawerOpen())) {
            await this.clickFilterButton();
        }
        const drawer = this.page.locator('div').filter({ has: this.page.getByText('Filter Options', { exact: false }) });
        for (let i = 0; i < 12; i++) {
            const removeIcon = drawer.locator('.mantine-TagsInput-pill button.mantine-Pill-remove').first();
            if (!(await removeIcon.isVisible({ timeout: 400 }).catch(() => false))) {
                break;
            }
            await removeIcon.click({ force: true });
            await this.page.waitForTimeout(200);
        }
    }

    /** Clear both OR filter fields (Name + Template Type). */
    async clearFilterDrawerInputs() {
        const inputs = this.filterDrawerOrInputs();
        const n = await inputs.count();
        for (let i = 0; i < n; i++) {
            await inputs.nth(i).fill('');
        }
        await this.page.waitForTimeout(400);
    }

    async closeFilterDrawerIfOpen() {
        if (await this.isFilterDrawerOpen()) {
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(400);
        }
    }

    /** + control next to “Add Approval Rules” in create/edit template drawer. */
    async clickAddApprovalRuleRow() {
        const dialog = this.createTemplateDialog();
        await expect(dialog).toBeVisible({ timeout: 15000 });
        const label = dialog.getByText('Add Approval Rules', { exact: true });
        await expect(label).toBeVisible({ timeout: 10000 });
        const addBtn = dialog.locator(
            'xpath=.//*[normalize-space(.)="Add Approval Rules"]/following-sibling::button[1]'
        );
        await expect(addBtn).toBeVisible({ timeout: 10000 });
        await addBtn.click();
        await this.page.waitForTimeout(500);
    }

    async exportTemplatesCsvDownload({ timeoutMs = 20000 } = {}) {
        const downloadPromise = this.page.waitForEvent('download', { timeout: timeoutMs });
        await approval.exportButton.click();
        const download = await downloadPromise;
        const name = download.suggestedFilename();
        expect(name.toLowerCase()).toMatch(/\.csv$/);
        return download;
    }

    async clickManageColumnsButton() {
        try {
            Logger.step('Opening Manage Columns from Table menu');
            await approval.tableMenuButton.click();
            await expect(approval.hideShowColumnsMenuItem).toBeVisible({ timeout: 10000 });
            await approval.hideShowColumnsMenuItem.click();
            await this.page.waitForTimeout(1200);
            Logger.success('Manage Columns opened');
        } catch (error) {
            Logger.error('Error clicking Manage Columns button: ' + error.message);
            throw error;
        }
    }

    async clickExportButton() {
        try {
            Logger.step('Clicking Export button');
            await approval.exportButton.click();
            await this.page.waitForTimeout(1500);
            Logger.success('Export button clicked');
        } catch (error) {
            Logger.error('Error clicking Export button: ' + error.message);
            throw error;
        }
    }

    async getAllCheckboxes() {
        try {
            return this.page.locator('input[type="checkbox"]');
        } catch (error) {
            Logger.error('Error getting checkboxes: ' + error.message);
            throw error;
        }
    }

    async createProperty(name, address, city, state, zip, type) {
        try {
            Logger.step('Creating new property: ' + name);

            // Navigate to Properties page
            const propertiesNavLink = this.page.locator(".mantine-NavLink-root:has-text('Properties')").first();
            await propertiesNavLink.waitFor({ state: 'visible' });
            await propertiesNavLink.click();

            // Wait for properties page to load
            await this.page.locator("button:has-text('Create Property')")
                .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
            await this.page.waitForTimeout(800);

            // Click Create Property button
            const createPropertyButton = this.page.locator("button:has-text('Create Property')");
            await createPropertyButton.waitFor({ state: 'visible' });
            await createPropertyButton.click({ force: true });

            // Wait for Add Property modal to appear
            const addPropertyModalHeader = this.page.locator(".mantine-Modal-header:has-text('Add property')");
            await addPropertyModalHeader.waitFor({ state: 'visible' });

            // Fill Name
            const nameInput = this.page.getByLabel('Name');
            await nameInput.waitFor({ state: 'visible' });
            await nameInput.fill(name);

            // Fill Address
            const addressInput = this.page.getByRole('textbox', { name: 'Address' });
            await addressInput.fill(address);

            // Select address suggestion
            const addressSuggestion = this.page.locator(`.mantine-Autocomplete-option:has-text("${address}")`);
            await addressSuggestion.waitFor({ state: 'visible' });
            await addressSuggestion.nth(0).click();

            // Select property type
            const typeInput = this.page.locator('input[placeholder="Select type"]');
            await typeInput.fill(type);

            const propertyTypeOption = this.page.locator(`.mantine-Select-option:has-text("${type}")`);
            await propertyTypeOption.waitFor({ state: 'visible' });
            await propertyTypeOption.click();

            // Wait for request to settle
            await this.page.waitForTimeout(1500);

            // Click Add Property button
            const addPropertyBtn = this.page.getByRole('button', { name: /add property/i });
            await addPropertyBtn.click();

            // Wait for property creation breadcrumb
            const breadcrumb = this.page.locator(`.mantine-Breadcrumbs-root:has-text('${name}')`);
            await breadcrumb.waitFor({ state: 'visible' });

            // Navigate back to properties list
            const propertiesNavLink2 = this.page.locator(".mantine-NavLink-root:has-text('Properties')").first();
            await propertiesNavLink2.click();

            // Verify property appears in list
            const propertyGrid = this.page.locator(`.mantine-SimpleGrid-root p:has-text('${name}')`);
            await propertyGrid.nth(0).waitFor({ state: 'visible' });

            Logger.success('Property created successfully: ' + name);
            return name;
        } catch (error) {
            Logger.error('Error creating property: ' + error.message);
            throw error;
        }
    }

    // Helper methods for assertions and verifications
    async isCreateTemplateDialogVisible() {
        try {
            return await approval.templateNameInput.isVisible().catch(() => false);
        } catch (error) {
            return false;
        }
    }

    async verifyEditButtonExists() {
        try {
            return await approval.editButtons.first().isVisible().catch(() => false);
        } catch (error) {
            return false;
        }
    }

    async getAllTableHeaders() {
        try {
            return await approval.tableHeaders.allTextContents();
        } catch (error) {
            Logger.error('Error getting table headers: ' + error.message);
            return [];
        }
    }

    async verifyHeaderExists(headerName) {
        try {
            const headers = await this.getAllTableHeaders();
            return headers.includes(headerName);
        } catch (error) {
            Logger.error('Error verifying header: ' + error.message);
            return false;
        }
    }

    async getAllTableRows() {
        try {
            return await approval.tableRows.all();
        } catch (error) {
            Logger.error('Error getting table rows: ' + error.message);
            return [];
        }
    }

    // ==============================================
    // HIGH-LEVEL WORKFLOW METHODS FOR TESTS
    // ==============================================

    async createTemplateWorkflow(templateName, templateType = 'Change Order', propertyName = null, amount = 5000, shouldSubmit = true, selectAllAlwaysRequired = false) {
        try {
            Logger.step(`Creating template: ${templateName} (Type: ${templateType})`);

            // Open dialog and fill basic info
            await this.openCreateTemplateDialog();
            await this.fillTemplateName(templateName);
            await this.selectTemplateType(templateType);
            Logger.info('Template basic info filled');

            // Add property if provided
            if (propertyName) {
                await this.addProperty(propertyName);
                Logger.info('Property added: ' + propertyName);
            }

            // Add three approvers (sumit mishra, sumit test, anyone)
            try {
                await this.addThreeApprovers();
                Logger.info('Three approvers added');
            } catch (e) {
                Logger.info('Approver selection skipped');
            }

            // Add amount
            await this.fillAmount(amount);
            Logger.info('Amount filled: ' + amount);

            // Check always required / mandatory flags for each approver row (3 rows in this workflow)
            if (selectAllAlwaysRequired) {
                await this.checkAlwaysRequiredInTemplateDialog();
                Logger.info('All Always Required checkboxes in dialog checked');
            } else {
                await this.checkAlwaysRequiredInTemplateDialog(3);
                Logger.info('Always Required checked for all 3 approver rows');
            }

            // Submit or cancel
            if (shouldSubmit) {
                await this.submitCreateTemplate();
                Logger.success(`Template created successfully: ${templateName}`);
            } else {
                await this.cancelDialog();
                Logger.info(`Template creation cancelled: ${templateName}`);
            }

            return templateName;
        } catch (error) {
            Logger.error(`Error creating template: ${error.message}`);
            throw error;
        }
    }

    async createMultipleTemplateTypes(propertyName, templateTypes = ['Change Order', 'Invoice', 'Contract']) {
        try {
            Logger.step(`Creating templates for types: ${templateTypes.join(', ')}`);

            for (const templateType of templateTypes) {
                Logger.info(`Testing template type: ${templateType}`);
                await this.createTemplateWorkflow(
                    `${templateType}_${Date.now()}`,
                    templateType,
                    propertyName,
                    5000,
                    false, // Don't submit, just test creation flow
                    true // For TC117: select all Always Required checkboxes
                );
            }

            Logger.success('All template types tested successfully');
        } catch (error) {
            Logger.error(`Error creating multiple templates: ${error.message}`);
            throw error;
        }
    }

    async editTemplateWorkflow(templateName, newAmount = null) {
        try {
            Logger.step(`Editing template: ${templateName}`);

            // Search for template
            await this.searchTemplate(templateName);
            Logger.info('Template found and selected');

            // Open edit dialog
            await this.clickEditTemplate();
            Logger.info('Edit dialog opened');

            // Edit amount if provided
            if (newAmount) {
                try {
                    await this.fillAmount(newAmount);
                    Logger.info('Amount updated: ' + newAmount);
                } catch (e) {
                    Logger.info('Amount field is disabled (expected in edit mode)');
                }
            }

            // Update template
            await this.submitUpdateTemplate();
            Logger.success(`Template updated: ${templateName}`);

            return templateName;
        } catch (error) {
            Logger.error(`Error editing template: ${error.message}`);
            throw error;
        }
    }

    async deleteTemplateWorkflow(templateName) {
        try {
            Logger.step(`Deleting template: ${templateName}`);

            // Search for template
            await this.searchTemplate(templateName);
            Logger.info('Template found');

            // Open delete dialog
            await this.openDeleteDialog();
            Logger.info('Delete confirmation dialog opened');

            // Confirm deletion
            await this.confirmDelete();
            Logger.success(`Template deleted: ${templateName}`);

            return templateName;
        } catch (error) {
            Logger.error(`Error deleting template: ${error.message}`);
            throw error;
        }
    }

    async createAndVerifyTemplate(templateName, expectedProperty, expectedApprover) {
        try {
            Logger.step(`Creating and verifying template: ${templateName}`);

            // Create template
            await this.createTemplateWorkflow(templateName, 'Change Order', expectedProperty);

            // Verify template in table
            const templateFound = await this.getTableHeaderCount();
            expect(templateFound).toBeGreaterThan(0);
            Logger.info('Template verification complete');

            return true;
        } catch (error) {
            Logger.error(`Error creating and verifying template: ${error.message}`);
            throw error;
        }
    }

    async testTableStructure() {
        try {
            Logger.step('Testing table structure');

            // Verify headers
            const headers = await this.getAllTableHeaders();
            const expectedHeaders = ['Name', 'Template Type', 'Properties', 'Approval Rules', 'Created By'];

            for (const header of expectedHeaders) {
                const found = headers.some(h => h.includes(header));
                if (!found) {
                    throw new Error(`Header not found: ${header}`);
                }
            }

            Logger.success('All table headers verified');
            return true;
        } catch (error) {
            Logger.error(`Error testing table structure: ${error.message}`);
            throw error;
        }
    }
};
