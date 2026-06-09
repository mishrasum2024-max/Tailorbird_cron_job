const { expect } = require("@playwright/test");
const { categoryPageLocators } = require("../locators/categoryPageLocator");

class FinancialsCategoryPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        const L = categoryPageLocators(page);
        this.catLoc = L;

        this.financialsNav = L.financialsNav;
        this.categoryLink = L.categoryLink;
        this.tableSelectors = L.tableSelectors;
        this.downloadSelectors = L.downloadSelectors;
        this.errorIndicators = L.errorIndicators;
        this.resetTableIcon = L.resetTableIcon;
        this.resetModal = L.resetModal;
        this.resetModalHeader = L.resetModalHeader;
        this.resetModalBody = L.resetModalBody;
        this.resetCancelBtn = L.resetCancelBtn;
        this.resetConfirmBtn = L.resetConfirmBtn;
        this.uploadFilesButton = L.uploadFilesButton;
        this.uploadDialog = L.uploadDialog;
        this.uploadFileInput = L.uploadFileInput;
        this.uploadListDialog = L.uploadListDialog;
        this.manageColumnsDrawer = L.manageColumnsDrawer;
        this.tableSettingsButton = L.tableSettingsButton;
        this.viewDetailsBtn = L.viewDetailsBtn;
        this.documentsHeader = L.documentsHeader;
        this.documentsSubHeader = L.documentsSubHeader;
        this.uploadFilesBtn = L.uploadFilesBtn;
        this.importDataButton = L.importDataButton;
    }

    /** Locators for TC07 visual / edge helpers (same shape as TC05/TC06 `tc05Loc`). */
    tc07Loc() {
        return this.catLoc;
    }

    async expandFinancialsSection() {
        await this.financialsNav.waitFor({ state: "visible" });
        const isExpanded =
            await this.financialsNav.getAttribute("aria-expanded");

        if (isExpanded !== "true") {
            await this.financialsNav.click();
            await this.page.waitForTimeout(300);
        }
    }

    async goToCategory() {
        let visible = await this.categoryLink.isVisible().catch(() => false);
        if (!visible) {
            const financialsVisible = await this.financialsNav.isVisible().catch(() => false);
            if (financialsVisible) {
                const expanded = await this.financialsNav.getAttribute("aria-expanded");
                if (expanded !== "true") {
                    await this.financialsNav.click();
                    await this.page.waitForTimeout(500);
                }
            }
            visible = await this.categoryLink.isVisible({ timeout: 3000 }).catch(() => false);
        }

        if (visible) {
            await this.categoryLink.click();
        } else {
            await this.page.goto("/financials/category", { waitUntil: "domcontentloaded" });
        }

        await this.page.waitForLoadState("domcontentloaded");
        await this.page.waitForTimeout(10000);
    }

    /**
     * Waits for the Category page to be fully loaded (content rendered).
     * Use before assertions that require page content.
     */
    async waitForCategoryPageReady(timeoutMs = 20000) {
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(10000);

        const contentIndicator = this.page.locator('table, [role="table"], [role="grid"], [role="treegrid"], button:has(svg.lucide-upload), [title="Import Data"], main')
            .first();
        await contentIndicator.waitFor({ state: 'visible', timeout: timeoutMs });
        await this.page.waitForTimeout(800);
    }

    async isTableVisible(timeoutMs = 2000) {
        for (const selector of this.tableSelectors) {
            const table = this.page.locator(selector).first();
            if (
                (await table.count()) &&
                (await table
                    .isVisible({ timeout: timeoutMs })
                    .catch(() => false))
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Waits for the category table/grid to be visible and loaded before interaction.
     */
    async waitForTableToLoad(timeoutMs = 15000) {
        const selectors = this.tableSelectors;
        const perTry = Math.max(3000, Math.ceil(timeoutMs / Math.min(selectors.length, 4)));
        for (const selector of selectors) {
            const table = this.page.locator(selector).first();
            try {
                await table.waitFor({ state: 'visible', timeout: perTry });
                await this.page.waitForTimeout(800);
                return true;
            } catch {
                continue;
            }
        }
        throw new Error('Category table did not load within timeout. Table/grid not visible.');
    }

    async isDownloadButtonVisible() {
        for (const selector of this.downloadSelectors) {
            const btn = this.page.locator(selector).first();
            if (
                (await btn.count()) &&
                (await btn
                    .isVisible({ timeout: 2000 })
                    .catch(() => false))
            ) {
                return true;
            }
        }
        return false;
    }

    async hasErrorIndicators() {
        for (const selector of this.errorIndicators) {
            const err = this.page.locator(selector);
            if (
                (await err.count()) &&
                (await err
                    .isVisible({ timeout: 1000 })
                    .catch(() => false))
            ) {
                return true;
            }
        }
        return false;
    }

    async validateResetCategoryContent() {
        await expect(this.resetModalHeader).toHaveText(
            "Reset Category Table"
        );

        const expectedText =
            "Are you sure you want to reset the category table? This will permanently delete all categories and set category references to null in: tasks, property assets, budget items, and job scopes. This action cannot be undone.";

        await expect(this.resetModalBody).toHaveText(expectedText);
        await expect(this.resetCancelBtn).toBeVisible();
        await expect(this.resetConfirmBtn).toBeVisible();
    }

    async uploadCategory(filePath) {
        await this.page.waitForLoadState("domcontentloaded");
        await this.page.waitForTimeout(10000);

        const contentReady = this.page.locator('button:has(svg.lucide-upload), [title="Import Data"], button:has-text("Import Data")').first();
        await contentReady.waitFor({ state: 'visible', timeout: 20000 });
        await this.page.waitForTimeout(1000);

        const importMainBtn = this.page.locator('main').getByRole('button', { name: /^Import$/i }).first();
        const uploadBtn = this.page.locator('button:has(svg.lucide-upload)').first();
        const importBtn = this.importDataButton;
        const importRoleBtn = this.page.getByRole('button', { name: 'Import Data' });

        let clicked = false;
        for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
            if (await importMainBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
                await importMainBtn.click();
                clicked = true;
            } else if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await uploadBtn.click();
                clicked = true;
            } else if (await importBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await importBtn.click();
                clicked = true;
            } else if (await importRoleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await importRoleBtn.click();
                clicked = true;
            }
            if (!clicked) {
                await this.page.waitForTimeout(1000);
            }
        }
        if (!clicked) {
            throw new Error('Import/Upload button not found after 3 attempts.');
        }

        await this.page.waitForTimeout(1500);

        const fromDeviceBtn = this.page.getByRole('button', { name: 'From device' });
        await fromDeviceBtn.waitFor({ state: 'visible', timeout: 15000 });

        const [fileChooser] = await Promise.all([
            this.page.waitForEvent('filechooser', { timeout: 15000 }),
            fromDeviceBtn.click(),
        ]);
        await fileChooser.setFiles(filePath);

        await this.page.waitForTimeout(2500);
        const doneBtn = this.page.getByRole('button', { name: 'Done' });
        await doneBtn.waitFor({ state: 'visible', timeout: 10000 });
        await doneBtn.click();
        await this.page.waitForTimeout(10000);
    }

    async filterCategory(columnName, filterValue) {
        const L = this.catLoc;
        await expect(L.filterFunnelBtn).toBeVisible();
        await L.filterFunnelBtn.click();
        await expect(L.filterPopover).toBeVisible();
        const header = L.filterPopover.getByText("Filters", { exact: true });
        await expect(header).toBeVisible();
        const closeBtn = L.filterPopover.locator(
            'button.mantine-CloseButton-root'
        );
        await expect(closeBtn).toBeVisible();
        const columnBlock = L.filterPopover.locator(
            `div:has(p:has-text("${columnName}"))`
        );
        await expect(columnBlock).toBeVisible();
        const columnLabel = columnBlock.getByText(columnName, { exact: true });
        await expect(columnLabel).toBeVisible();
        const filterInput = columnBlock.locator(
            'input.mantine-PillsInputField-field'
        );
        await expect(filterInput).toBeVisible();
        await expect(filterInput).toBeEditable();
        await filterInput.fill(filterValue);
        await expect(filterInput).toHaveValue(filterValue);
        await this.page.waitForTimeout(10000);
    }

    async filterCategoryAndVerify(columnName, filterValue) {
        const L = this.catLoc;
        await expect(L.filterFunnelBtn).toBeVisible();
        await L.filterFunnelBtn.click();
        await this.page.waitForTimeout(500);

        const filterInput = L.filterGlobalSearch;
        await expect(filterInput).toBeVisible();
        await expect(filterInput).toBeEditable();

        await filterInput.fill(String(filterValue));
        await filterInput.press('Enter');

        await this.page.waitForTimeout(10000);

        const matchingCells = this.page.locator('[role="gridcell"]').filter({
            hasText: filterValue
        });
        const rowCount = await matchingCells.count();

        if (rowCount === 0) {
            throw new Error(`No rows found after filtering "${columnName}" with value "${filterValue}"`);
        }

        const closeFilterBtn = this.page.locator('button:has(svg.lucide-x)').filter({
            near: this.page.getByText('Filters', { exact: true })
        }).first();

        if (await closeFilterBtn.isVisible().catch(() => false)) {
            await closeFilterBtn.click();
            await this.page.waitForTimeout(500);
        }

        return rowCount;
    }

    /**
     * Category grid lives under `main`, not the Properties "Locations" tabpanel.
     * Call after `bt-add-row` (or equivalent) has been clicked if a menu is required.
     */
    async addCategoryRowByName(rowName = 'My Test Name') {
        const main = this.page.locator('main').first();
        const addChoice = this.page
            .getByRole('menuitem', { name: /Add Data|Add row|Add site|Add unit/i })
            .first();
        if (await addChoice.isVisible({ timeout: 3500 }).catch(() => false)) {
            await addChoice.click({ force: true }).catch(() => {});
            await this.page.waitForTimeout(800);
        }

        let treegrid = main.getByRole('treegrid').first();
        if (!(await treegrid.isVisible({ timeout: 4000 }).catch(() => false))) {
            treegrid = this.page.getByRole('treegrid').first();
        }
        await expect(treegrid).toBeVisible({ timeout: 15000 });

        const newRow = treegrid
            .getByRole('row', { name: /—/ })
            .first()
            .or(treegrid.locator('[role="row"]').filter({ has: treegrid.locator('[role="gridcell"]') }).first());
        await expect(newRow).toBeVisible({ timeout: 15000 });

        const firstCell = newRow.getByRole('gridcell').first();
        await expect(firstCell).toBeVisible({ timeout: 10000 });
        await firstCell.click({ force: true });
        await firstCell.dblclick({ force: true }).catch(() => {});
        await this.page.waitForTimeout(300);

        const nameEditorCandidates = [
            this.page.locator('revogr-edit input:visible:not([readonly]):not([disabled])').first(),
            this.page.locator('input[type="text"]:visible:not([readonly]):not([disabled])').first(),
            this.page.locator('textarea:visible:not([readonly]):not([disabled])').first(),
            this.page.getByRole('textbox', { name: /name/i }).first(),
        ];
        let filled = false;
        for (const editor of nameEditorCandidates) {
            const visible = await editor.isVisible({ timeout: 800 }).catch(() => false);
            if (!visible) continue;
            const editable = await editor.isEditable().catch(() => false);
            if (!editable) continue;
            await editor.click({ force: true }).catch(() => {});
            await editor.fill(rowName, { timeout: 3000 });
            filled = true;
            break;
        }
        if (!filled) {
            const inlineEditor = this.page.locator('[contenteditable="true"]:visible').last();
            if (await inlineEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
                await inlineEditor.click({ force: true }).catch(() => {});
                await this.page.keyboard.press('Control+A').catch(() => {});
                await this.page.keyboard.type(rowName, { delay: 20 });
            } else {
                await firstCell.click({ force: true }).catch(() => {});
                await this.page.keyboard.press('Control+A').catch(() => {});
                await this.page.keyboard.press('Backspace').catch(() => {});
                await this.page.keyboard.type(rowName, { delay: 20 });
            }
        }
        await this.page.keyboard.press("Enter");

        const cellInMainGrid = () => {
            const esc = rowName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return main
                .getByRole('treegrid')
                .first()
                .getByRole('gridcell', { name: rowName })
                .or(main.getByRole('treegrid').first().locator('[role="gridcell"]').filter({ hasText: new RegExp(esc, 'i') }))
                .first();
        };

        const rowAdded = await cellInMainGrid()
            .isVisible({ timeout: 6000 })
            .catch(() => false);
        if (!rowAdded) {
            const lateEditor = this.page.locator('input[type="text"]:visible, textarea:visible').first();
            if (await lateEditor.isVisible({ timeout: 1200 }).catch(() => false)) {
                await lateEditor.fill(rowName).catch(() => {});
                await this.page.keyboard.press('Enter').catch(() => {});
            }
            // CI fallback: use search to scroll the added row into view (handles virtualized grids)
            const searchInput = this.catLoc.mainSearchInput;
            if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await searchInput.fill(rowName).catch(() => {});
                await this.page.waitForTimeout(1500);
            }
        }

        // Final check: row must be visible in the grid
        const startWait = Date.now();
        const rowVisible = await cellInMainGrid()
            .waitFor({ state: 'visible', timeout: 20_000 })
            .then(() => true)
            .catch(() => false);

        if (!rowVisible) {
            // Last resort: try scrolling to the added row via the search input
            const searchInput = this.catLoc.mainSearchInput;
            if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await searchInput.fill(rowName).catch(() => {});
                await this.page.waitForTimeout(2000);
            }
            console.warn(`[addCategoryRowByName] Row '${rowName}' not found after ${Date.now() - startWait}ms — asserting with remaining time`);
        }

        await expect(cellInMainGrid()).toBeVisible({ timeout: 15000 });
        await this.page.waitForTimeout(3000);
    }

    async addCategoryRowDetail() {
        return this.addCategoryRowByName('My Test Name');
    }

    async deleteCategoryRowByName(rowName = 'My Test Name') {
        const main = this.page.locator('main').first();
        let treegrid = main.getByRole('treegrid').first();
        if (!(await treegrid.isVisible({ timeout: 4000 }).catch(() => false))) {
            treegrid = this.page.getByRole('treegrid').first();
        }
        await expect(treegrid).toBeVisible({ timeout: 15000 });

        const search = this.catLoc.mainSearchInput;
        if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
            await search.fill(rowName).catch(() => {});
            await search.press('Enter').catch(() => {});
            await this.page.waitForTimeout(10000);
        }

        const dataRows = treegrid.locator('[role="row"]').filter({ has: this.page.locator('[role="gridcell"]:not(:has(button))') });
        const matchedRow = treegrid
            .locator('[role="row"]')
            .filter({ has: this.page.locator(`[role="gridcell"]:has-text("${rowName}")`) })
            .first();
        if (!(await matchedRow.isVisible({ timeout: 5000 }).catch(() => false))) {
            if (await search.isVisible({ timeout: 800 }).catch(() => false)) {
                await search.fill('').catch(() => {});
                await search.press('Enter').catch(() => {});
            }
            return false;
        }
        const rowCount = await dataRows.count();
        let rowIndex = -1;
        for (let i = 0; i < rowCount; i++) {
            const hasMatch = await dataRows.nth(i).locator(`[role="gridcell"]:has-text("${rowName}")`).count() > 0;
            if (hasMatch) {
                rowIndex = i;
                break;
            }
        }
        const row = rowIndex >= 0 ? dataRows.nth(rowIndex) : matchedRow;
        const deleteBtn = row
            .locator('button:has(svg.lucide-trash2), button[title*="Delete"], button[aria-label*="Delete"]')
            .first();
        if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await deleteBtn.scrollIntoViewIfNeeded().catch(() => {});
            await deleteBtn.click({ force: true });
        } else {
            await row.getByRole('gridcell').first().click({ force: true });
            await this.page.keyboard.press('Delete').catch(() => {});
        }

        const confirmBtn = this.page.getByRole('button', { name: 'Delete' });
        const popoverDelete = this.page.locator('.mantine-Popover-dropdown button:has-text("Delete")');
        const btnToClick = confirmBtn.or(popoverDelete);
        if (await btnToClick.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await btnToClick.first().click();
        }
        if (await search.isVisible({ timeout: 800 }).catch(() => false)) {
            await search.fill('').catch(() => {});
            await search.press('Enter').catch(() => {});
        }
        await this.page.waitForTimeout(10000);
        return true;
    }

    async deleteCategoryRowDetail() {
        return this.deleteCategoryRowByName('My Test Name');
    }

    /** Reset Category destructive modal — scoped heading to avoid overlapping dialogs. */
    resetCategoryConfirmModal() {
        return this.page
            .locator('section[role="dialog"]')
            .filter({ has: this.page.getByRole('heading', { name: /Reset Category Table/i }) });
    }

    async openResetCategoryModalScoped() {
        await this.page.locator('main').first().evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
        await this.page.waitForTimeout(400);

        const resetToolbarBtn = this.page.getByRole('button', { name: /^Reset Table$/i }).first();
        let opened = false;
        if (await resetToolbarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await resetToolbarBtn.scrollIntoViewIfNeeded().catch(() => {});
            await resetToolbarBtn.click();
            opened = true;
        }
        if (!opened) {
            await this.resetTableIcon.first().waitFor({ state: 'visible', timeout: 15000 });
            await this.resetTableIcon.first().click();
        }

        const modal = this.resetCategoryConfirmModal();
        await expect(modal).toBeVisible({ timeout: 12000 });
        await expect(modal.getByRole('heading', { name: /Reset Category Table/i })).toBeVisible();
    }

    async cancelResetCategoryModalScoped() {
        const modal = this.resetCategoryConfirmModal();
        await modal.getByRole('button', { name: /^Cancel$/i }).click();
        await expect(modal).toBeHidden({ timeout: 15000 });
    }

    async openTableActionMenu() {
        const trigger = this.page.locator('main').getByTestId('bt-table-action').first();
        await trigger.waitFor({ state: 'visible', timeout: 12000 });
        await trigger.scrollIntoViewIfNeeded().catch(() => {});
        await trigger.click({ force: true });
        await this.page.waitForTimeout(450);

        // BirdTable portals menu items — class may be Menu, Popover, or composited; probe a stable test id first.
        const portalItemProbe = this.page.getByTestId('bt-table-action-hide-show-columns').first();
        const shell = this.page
            .locator('.mantine-Menu-dropdown')
            .or(this.page.locator('.mantine-Popover-dropdown'))
            .or(this.page.locator('[role="menu"]'))
            .first();
        // Do not combine probe.or(shell): both can match at once → strict mode violation on toBeVisible().
        await portalItemProbe.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
            await shell.waitFor({ state: 'visible', timeout: 12000 });
        });
    }

    async dismissMenuOrPopover() {
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(450);
    }

    async openManageColumnsDialogFromMenu() {
        await this.openTableActionMenu();
        await this.page.getByTestId('bt-table-action-hide-show-columns').first().click({ timeout: 12000 });
        await expect(this.catLoc.manageColumnsDialog).toBeVisible({ timeout: 12000 });
    }

    async dismissDialogWithEscape(dialogLocator) {
        await this.page.keyboard.press('Escape').catch(() => {});
        await dialogLocator.waitFor({ state: 'hidden', timeout: 12000 }).catch(() => {});
        await this.page.waitForTimeout(400);
    }

    async openAddColumnModalFromMenu() {
        await this.openTableActionMenu();
        const addColumnMenuItem = this.page
            .getByTestId('bt-table-action-add-column')
            .or(this.page.getByRole('menuitem', { name: /Add custom column|Add column/i }))
            .first();
        await expect(addColumnMenuItem).toBeVisible({ timeout: 10000 });
        await addColumnMenuItem.click();
        await expect(
            this.page.getByRole('textbox', { name: /Enter column name/i })
                .or(this.page.getByPlaceholder(/Enter column name/i)).first(),
        ).toBeVisible({ timeout: 12000 });
    }

    async dismissAddColumnModal() {
        const cancel = this.page.getByRole('button', { name: /^Cancel$/i }).first();
        if (await cancel.isVisible({ timeout: 2500 }).catch(() => false)) {
            await cancel.click();
        } else {
            await this.page.keyboard.press('Escape').catch(() => {});
        }
        await this.page.waitForTimeout(400);
    }

    /**
     * Opens Import/Upload first step only (visual / smoke). Does not select a file.
     */
    async openImportPickerVisual() {
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(800);
        const uploadBtn = this.page.locator('button:has(svg.lucide-upload)').first();
        const importMainBtn = this.page.locator('main').getByRole('button', { name: /^Import$/i }).first();
        const importBtn = this.importDataButton;
        const importRoleBtn = this.page.getByRole('button', { name: 'Import Data' });
        let clicked = false;
        for (let attempt = 1; attempt <= 4 && !clicked; attempt++) {
            if (await importMainBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await importMainBtn.click();
                clicked = true;
            } else if (await uploadBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
                await uploadBtn.click();
                clicked = true;
            } else if (await importBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                await importBtn.click({ force: true });
                clicked = true;
            } else if (await importRoleBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                await importRoleBtn.click();
                clicked = true;
            } else {
                await this.page.waitForTimeout(500);
            }
        }
        if (!clicked) throw new Error('Could not open import/upload launcher for visual');
        await this.page.waitForTimeout(1200);
        await expect(this.page.getByRole('button', { name: 'From device' })).toBeVisible({ timeout: 20000 });
    }

    async dismissImportPickerVisual() {
        const cancel = this.page.getByRole('button', { name: /^Cancel$/i }).first();
        const close = this.page.getByRole('button', { name: /^Close$/i }).first();
        if (await cancel.isVisible({ timeout: 2000 }).catch(() => false)) {
            await cancel.click();
        } else if (await close.isVisible({ timeout: 1500 }).catch(() => false)) {
            await close.click();
        }
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(600);
        await expect(this.page.getByRole('button', { name: 'From device' })).toBeHidden({ timeout: 10000 }).catch(() => {});
    }
}

module.exports = { FinancialsCategoryPage };
