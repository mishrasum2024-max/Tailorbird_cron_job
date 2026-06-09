const { expect } = require('@playwright/test');
const { unitInteriorLocators } = require('../locators/unitInteriorLocator');
const { Logger } = require('../utils/logger');
const { InteractionLogger } = require('../utils/InteractionLogger');

/** Fixed test job. JOB_NAME is used for searching; JOB_ID only for URL verification. */
const JOB_NAME = "Automation Job, please don't delete it";
const JOB_ID   = '3828';

class UnitInteriorPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
        this.page = page;
        this.loc  = unitInteriorLocators(page);
    }

    // ── Navigation (UI-driven — no hardcoded job URLs) ─────────────────────

    /**
     * Starting from the dashboard or any app page, click "Jobs (Contracts & POs)"
     * in the left nav to land on the Jobs listing page.
     */
    async openJobsFromLeftNav() {
        Logger.info('[UnitInterior] Clicking Jobs (Contracts & POs) in left nav');
        const navItem = this.page.locator('nav')
            .locator('a, button, div')
            .filter({ hasText: /^Jobs \(Contracts & POs\)$/i })
            .first();
        await navItem.waitFor({ state: 'visible', timeout: 15000 });
        InteractionLogger.logButtonClick('Jobs (Contracts & POs) nav item', 'Jobs (Contracts & POs)');
        await navItem.click();
        await this.page.waitForURL(/\/jobs/, { timeout: 20000 });
        await this.page.waitForTimeout(2000);
        Logger.success('[UnitInterior] Jobs listing page loaded');
    }

    /**
     * Search the jobs listing for JOB_NAME, then click the result's ID link to
     * open the job detail page.  Verifies the resulting URL contains JOB_ID.
     */
    async searchAndOpenJob() {
        Logger.info(`[UnitInterior] Searching for job: "${JOB_NAME}"`);
        const searchInput = this.page.locator('input[placeholder="Search..."]').first();
        await searchInput.waitFor({ state: 'visible', timeout: 30000 });
        InteractionLogger.logFormFill('Jobs search input', JOB_NAME);
        await searchInput.fill(JOB_NAME);
        await this.page.waitForTimeout(1500);

        // Find the row that matches the exact job name and click its ID link
        const matchingRow = this.page
            .getByRole('row')
            .filter({ hasText: JOB_NAME })
            .first();
        await matchingRow.waitFor({ state: 'visible', timeout: 15000 });

        // The ID link navigates to the job detail page
        const jobIdLink = matchingRow.locator('a[href*="/jobs/"]').first();
        await jobIdLink.waitFor({ state: 'visible', timeout: 10000 });
        const jobIdText = await jobIdLink.textContent();
        InteractionLogger.logButtonClick(`Job ID link: ${jobIdText?.trim()}`, jobIdText?.trim() ?? '');
        await jobIdLink.click();

        await this.page.waitForURL(new RegExp(`/jobs/${JOB_ID}`), { timeout: 30000 });
        await this.page.waitForTimeout(1500);
        Logger.success(`[UnitInterior] Opened job detail for "${JOB_NAME}" (confirmed URL contains ${JOB_ID})`);
    }

    /**
     * Click the Contracts tab on the job detail page and wait for
     * the URL to include ?tab=contracts.
     */
    async navigateToContractsTab() {
        Logger.info('[UnitInterior] Clicking Contracts tab');
        const tab = this.loc.contractsTab;
        await tab.waitFor({ state: 'visible', timeout: 15000 });
        InteractionLogger.logButtonClick('Contracts tab', 'Contracts');
        await tab.click();
        await this.page.waitForURL(/tab=contracts/, { timeout: 15000 });
        await this.page.waitForTimeout(1000);
        Logger.success('[UnitInterior] Contracts tab active');
    }

    /**
     * Click the Units sub-tab inside the Contracts panel and wait for the
     * URL to include contractSubTab=units.
     */
    async navigateToUnitsSubTab() {
        Logger.info('[UnitInterior] Clicking Units sub-tab');
        const subTab = this.loc.unitsSubTab;
        await subTab.waitFor({ state: 'visible', timeout: 15000 });
        InteractionLogger.logButtonClick('Units sub-tab', 'Units');
        await subTab.click();
        await this.page.waitForURL(/contractSubTab=units/, { timeout: 15000 });
        await this.loc.unitsPanel.waitFor({ state: 'visible', timeout: 15000 });
        await this.page.waitForTimeout(1000);
        Logger.success('[UnitInterior] Units sub-tab active');
    }

    /**
     * Full E2E navigation: left nav → jobs list → search job → open job →
     * Contracts tab → Units sub-tab.
     * Use in tests that must demonstrate the complete user journey.
     */
    async navigateToUnitsTabFromDashboard() {
        await this.openJobsFromLeftNav();
        await this.searchAndOpenJob();
        await this.navigateToContractsTab();
        await this.navigateToUnitsSubTab();
    }

    /**
     * Abbreviated navigation starting from the Jobs listing page
     * (already at /jobs): search → open job → Contracts → Units.
     */
    async navigateToUnitsTabFromJobsList() {
        await this.searchAndOpenJob();
        await this.navigateToContractsTab();
        await this.navigateToUnitsSubTab();
    }

    // ── Grid helpers ──────────────────────────────────────────────────────

    /** Returns text of all visible column headers in the Units grid. */
    async getColumnHeaders() {
        const headers = await this.page
            .getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader')
            .allTextContents();
        const cleaned = headers.map(h => h.trim()).filter(Boolean);
        Logger.info(`[UnitInterior] Column headers: ${JSON.stringify(cleaned)}`);
        return cleaned;
    }

    /** Returns the number of data rows currently visible in the Units grid. */
    async getGridRowCount() {
        const count = await this.loc.allGridRows.count();
        Logger.info(`[UnitInterior] Units grid row count: ${count}`);
        return count;
    }

    /**
     * Returns the current status text for a given unit number.
     *
     * RevoGrid renders as a Web Component (<revo-grid>) with a shadow DOM.
     * document.querySelectorAll() cannot pierce the shadow root, so page.evaluate
     * returns nothing.  Playwright's CSS locators DO pierce shadow DOM by default.
     *
     * Pattern (mirrors TC06 contract-grid code):
     *   1. Find the gridcell whose visible text is exactly the unit number using a
     *      Playwright locator (which traverses the shadow DOM).
     *   2. Read its data-rgrow attribute — RevoGrid stamps this on every cell to
     *      identify which logical row it belongs to.
     *   3. Collect all gridcells with the same data-rgrow and scan for a known status.
     */
    async getUnitStatus(unitNumber) {
        await this.page.waitForTimeout(500);

        const unitsGrid = this.page
            .getByRole('tabpanel', { name: 'Units' })
            .locator('[role="treegrid"]')
            .first();

        // Playwright pierces shadow DOM when evaluating CSS selectors, so this
        // finds the <div role="gridcell"> inside revo-grid's shadow root.
        const unitCell = unitsGrid
            .locator('div[role="gridcell"]')
            .filter({ hasText: new RegExp(`^\\s*${unitNumber}\\s*$`) })
            .first();

        const cellVisible = await unitCell.isVisible({ timeout: 5000 }).catch(() => false);
        if (!cellVisible) {
            Logger.info(`[UnitInterior] Unit ${unitNumber}: gridcell not found (shadow DOM or virtual scroll?)`);
            return null;
        }

        // data-rgrow ties a cell to its logical row (TC06 pattern)
        const rgRow = await unitCell.getAttribute('data-rgrow').catch(() => null);
        Logger.info(`[UnitInterior] Unit ${unitNumber} cell data-rgrow: "${rgRow}"`);
        if (!rgRow) {
            Logger.info(`[UnitInterior] Unit ${unitNumber}: data-rgrow missing on unit cell`);
            return null;
        }

        // All cells sharing data-rgrow belong to the same logical row.
        // IMPORTANT: allTextContents() uses element.textContent which includes
        // Mantine's injected <style> tag content, polluting every cell string.
        // Use evaluateAll with el.innerText instead — innerText skips <style>/<script>
        // and returns only the rendered visible text (e.g. "Released", "2bdrm").
        const rowCellTexts = await unitsGrid
            .locator(`div[role="gridcell"][data-rgrow="${rgRow}"]`)
            .evaluateAll(els => els.map(el => (el.innerText || '').trim()));

        const cleaned = rowCellTexts.filter(Boolean);
        Logger.info(`[UnitInterior] Unit ${unitNumber} row cells (innerText): ${JSON.stringify(cleaned)}`);

        const knownStatuses = this.loc.KNOWN_STATUS_VALUES;
        const found = cleaned.find(t => knownStatuses.includes(t));
        Logger.info(`[UnitInterior] Unit ${unitNumber} — status: "${found ?? 'null'}"`);
        return found ?? null;
    }

    /** Returns true when the › expand toggle button is visible for the given unit row. */
    async unitHasToggleButton(unitNumber) {
        const hasToggle = await this.loc.rowToggleBtnByUnitNum(unitNumber)
            .isVisible({ timeout: 2000 })
            .catch(() => false);
        Logger.info(`[UnitInterior] Unit ${unitNumber} has toggle (› button): ${hasToggle}`);
        return hasToggle;
    }

    // ── Row selection ─────────────────────────────────────────────────────

    /** Checks the row checkbox for a given unit number if not already checked. */
    async selectUnit(unitNumber) {
        const checkbox = this.loc.rowCheckboxByUnitNum(unitNumber);
        await checkbox.waitFor({ state: 'visible', timeout: 10000 });
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
            InteractionLogger.logInteraction('click', `Checkbox unit ${unitNumber}`, String(unitNumber));
            await checkbox.click();
            await this.page.waitForTimeout(400);
        }
        Logger.success(`[UnitInterior] Unit ${unitNumber} selected`);
    }

    /** Unchecks the row checkbox for a given unit number if currently checked. */
    async deselectUnit(unitNumber) {
        const checkbox = this.loc.rowCheckboxByUnitNum(unitNumber);
        await checkbox.waitFor({ state: 'visible', timeout: 10000 });
        const isChecked = await checkbox.isChecked();
        if (isChecked) {
            await checkbox.click();
            await this.page.waitForTimeout(400);
        }
        Logger.info(`[UnitInterior] Unit ${unitNumber} deselected`);
    }

    /** Selects multiple units. */
    async selectUnits(...unitNumbers) {
        for (const num of unitNumbers) {
            await this.selectUnit(num);
        }
    }

    /** Unchecks all currently selected rows (dismisses any blocking overlay first). */
    async clearAllSelections() {
        Logger.info('[UnitInterior] Clearing all row selections');

        // Dismiss any stray Mantine modal overlay that might block checkbox clicks
        const overlay = this.page.locator('[data-fixed="true"].mantine-Modal-overlay, .mantine-Overlay-root[data-fixed="true"]').first();
        if (await overlay.isVisible({ timeout: 800 }).catch(() => false)) {
            Logger.info('[UnitInterior] clearAllSelections: overlay blocking — pressing Escape');
            await this.page.keyboard.press('Escape');
            await overlay.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
            await this.page.waitForTimeout(500);
        }

        const checkboxes = await this.loc.allGridRows.getByRole('checkbox').all();
        for (const cb of checkboxes) {
            if (await cb.isChecked().catch(() => false)) {
                await cb.click();
                await this.page.waitForTimeout(150);
            }
        }
        Logger.success('[UnitInterior] All selections cleared');
    }

    // ── Button state helpers ──────────────────────────────────────────────

    /**
     * Returns the enabled/disabled state of all three toolbar buttons.
     * @returns {{ editScopes: boolean, updateStatus: boolean, releaseUnits: boolean }}
     */
    async getButtonStates() {
        const editScopesDisabled   = await this.loc.editScopesBtn.isDisabled().catch(() => true);
        const updateStatusDisabled = await this.loc.updateStatusBtn.isDisabled().catch(() => true);
        const releaseUnitsDisabled = await this.loc.releaseUnitsBtn.isDisabled().catch(() => true);
        const states = {
            editScopes:   !editScopesDisabled,
            updateStatus: !updateStatusDisabled,
            releaseUnits: !releaseUnitsDisabled,
        };
        Logger.info(`[UnitInterior] Button states: ${JSON.stringify(states)}`);
        return states;
    }

    /**
     * Asserts button enabled/disabled state and logs result.
     * @param {string}  buttonName
     * @param {boolean} expectedEnabled
     */
    async assertButtonEnabled(buttonName, expectedEnabled) {
        const btn = this.page.getByRole('button', { name: buttonName });
        await btn.waitFor({ state: 'visible', timeout: 10000 });
        const actualEnabled = !(await btn.isDisabled());
        const passed = actualEnabled === expectedEnabled;
        InteractionLogger.logAssertion(
            'ButtonState', `"${buttonName}" button`,
            expectedEnabled ? 'enabled' : 'disabled',
            actualEnabled  ? 'enabled' : 'disabled',
            passed,
        );
        expect(
            actualEnabled,
            `Button "${buttonName}" should be ${expectedEnabled ? 'enabled' : 'disabled'}`,
        ).toBe(expectedEnabled);
    }

    // ── Update Status dropdown ────────────────────────────────────────────

    /** Opens the Update Status dropdown and waits for the menu to appear. */
    async openUpdateStatusDropdown() {
        Logger.info('[UnitInterior] Opening Update Status dropdown');
        await expect(this.loc.updateStatusBtn).toBeEnabled({ timeout: 10000 });
        InteractionLogger.logButtonClick('Update Status', 'Update Status');
        await this.loc.updateStatusBtn.click();
        await this.loc.updateStatusMenu.waitFor({ state: 'visible', timeout: 10000 });
        Logger.success('[UnitInterior] Update Status dropdown open');
    }

    /**
     * Opens dropdown, captures all option texts, closes via Escape, returns list.
     */
    async getUpdateStatusOptions() {
        await this.openUpdateStatusDropdown();
        const options = await this.loc.updateStatusMenu
            .getByRole('menuitem')
            .allTextContents();
        const cleaned = options.map(o => o.trim()).filter(Boolean);
        Logger.info(`[UnitInterior] Update Status options: ${JSON.stringify(cleaned)}`);
        await this.page.keyboard.press('Escape');
        await this.loc.updateStatusMenu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        return cleaned;
    }

    /**
     * Selects a specific option from the already-open dropdown and waits for
     * the grid to settle.  Some transitions (e.g. reverting a Released unit to
     * "Not in Reno") trigger a Mantine confirmation/warning modal.  We handle it
     * by clicking the primary action button when present, or pressing Escape when
     * no actionable button is found, so the overlay never blocks subsequent steps.
     * @param {string} statusName
     */
    async selectStatusOption(statusName) {
        const option = this.loc.statusMenuOption(statusName);
        await option.waitFor({ state: 'visible', timeout: 10000 });
        InteractionLogger.logButtonClick(`Status option "${statusName}"`, statusName);
        await option.click();
        await this.page.waitForTimeout(1200);

        // Detect and dismiss any confirmation/error modal that may appear
        const modal = this.page.locator('[role="dialog"], .mantine-Modal-content').first();
        const overlay = this.page.locator('[data-fixed="true"].mantine-Modal-overlay, .mantine-Overlay-root[data-fixed="true"]').first();
        const hasOverlay = await overlay.isVisible({ timeout: 1500 }).catch(() => false);

        if (hasOverlay) {
            Logger.info(`[UnitInterior] Modal overlay detected after selecting "${statusName}" — scanning buttons`);
            // Log ALL button texts so we can see exactly what the modal offers
            const allBtns = await modal.getByRole('button').all();
            const btnTexts = [];
            for (const b of allBtns) {
                const t = (await b.textContent().catch(() => '')).trim();
                if (t) btnTexts.push(t);
            }
            Logger.info(`[UnitInterior] Modal buttons found: ${JSON.stringify(btnTexts)}`);

            // Click the FIRST button that is: not Cancel/Close/Dismiss AND is enabled
            // (e.g. Release Units dialog has "Apply same Scope to all Units" [disabled] + "Release with Scopes" [enabled])
            let clicked = false;
            for (const b of allBtns) {
                const t = (await b.textContent().catch(() => '')).trim();
                if (!t || /^(cancel|close|no|back|dismiss|skip)$/i.test(t)) continue;
                const visible = await b.isVisible({ timeout: 1000 }).catch(() => false);
                const enabled = await b.isEnabled().catch(() => false);
                if (visible && enabled) {
                    Logger.info(`[UnitInterior] Clicking modal action button: "${t}"`);
                    await b.click();
                    clicked = true;
                    break;
                }
                Logger.info(`[UnitInterior] Skipping modal button "${t}" (visible=${visible}, enabled=${enabled})`);
            }
            if (!clicked) {
                Logger.info(`[UnitInterior] No actionable button found — pressing Escape to dismiss`);
                await this.page.keyboard.press('Escape');
            }

            await this.page.waitForTimeout(1000);
            // Ensure overlay is gone before returning
            await overlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        }

        await this.page.waitForTimeout(800);
        Logger.success(`[UnitInterior] Status option "${statusName}" handled`);
    }

    /**
     * Full e2e status update for a single unit:
     *   1. Select the unit checkbox
     *   2. Open Update Status dropdown
     *   3. Click the given status option
     *   4. Wait for grid to reflect the new status
     *   5. Return the new status read back from grid
     *
     * @param {number}  unitNumber
     * @param {string}  targetStatus - exact option label e.g. 'In Progress'
     * @returns {string|null} actual status after change
     */
    async updateUnitStatus(unitNumber, targetStatus) {
        Logger.info(`[UnitInterior] Updating unit ${unitNumber} status → "${targetStatus}"`);
        await this.selectUnit(unitNumber);
        await this.openUpdateStatusDropdown();
        await this.selectStatusOption(targetStatus);

        // Poll until status reflects in the grid (up to 5 tries)
        let actual = null;
        for (let i = 0; i < 5; i++) {
            actual = await this.getUnitStatus(unitNumber);
            if (actual === targetStatus) break;
            await this.page.waitForTimeout(1000);
        }
        Logger.info(`[UnitInterior] Unit ${unitNumber} status after update: "${actual}"`);
        return actual;
    }

    /**
     * Conditional status toggle between preferA and preferB.
     * Reads current status of primaryUnit, then selects the opposite.
     * If current is neither, defaults to preferB.
     *
     * @param {number[]} unitNumbers
     * @param {string}   preferA  default 'In Progress'
     * @param {string}   preferB  default 'Not Started'
     * @returns {string} target status applied
     */
    async updateStatusConditional(unitNumbers, preferA = 'In Progress', preferB = 'Not Started') {
        Logger.info(`[UnitInterior] Conditional update for units ${unitNumbers.join(', ')}`);
        const current = await this.getUnitStatus(unitNumbers[0]);
        let target;
        if (current === preferA) {
            target = preferB;
            Logger.info(`[UnitInterior] Current="${preferA}" → target="${preferB}"`);
        } else if (current === preferB) {
            target = preferA;
            Logger.info(`[UnitInterior] Current="${preferB}" → target="${preferA}"`);
        } else {
            target = preferB;
            Logger.info(`[UnitInterior] Current="${current}" (neither) → default to "${preferB}"`);
        }

        await this.selectUnits(...unitNumbers);
        const states = await this.getButtonStates();
        expect(states.updateStatus, `Update Status must be enabled for toggle-row units`).toBe(true);
        await this.openUpdateStatusDropdown();
        await this.selectStatusOption(target);
        Logger.success(`[UnitInterior] Conditional update → "${target}"`);
        return target;
    }

    // ── Release Units dialog ──────────────────────────────────────────────

    /** Clicks Release Units button, waits for dialog to appear. */
    async clickReleaseUnitsButton() {
        Logger.info('[UnitInterior] Clicking Release Units');
        await expect(this.loc.releaseUnitsBtn).toBeEnabled({ timeout: 10000 });
        InteractionLogger.logButtonClick('Release Units', 'Release Units');
        await this.loc.releaseUnitsBtn.click();
        await this.loc.releaseUnitsDialog.waitFor({ state: 'visible', timeout: 15000 });
        Logger.success('[UnitInterior] Release Units dialog open');
    }

    /**
     * Reads and returns all visible text content from the open Release Units dialog.
     */
    async getReleaseDialogContent() {
        const dialog = this.loc.releaseUnitsDialog;
        await dialog.waitFor({ state: 'visible', timeout: 10000 });

        const allParas   = await dialog.locator('p').allTextContents();
        const title      = allParas.find(t => /Release Units/i.test(t))?.trim()      ?? '';
        const subtitle   = allParas.find(t => /Select which scopes/i.test(t))?.trim() ?? '';

        const headerCells  = await dialog.locator('thead th').allTextContents();
        const tableHeaders = headerCells.map(h => h.trim()).filter(Boolean);

        const tableRowCount = await dialog.locator('tbody tr').count().catch(() => 0);

        const selectAllVisible      = await this.loc.selectAllScopesCheckbox.isVisible({ timeout: 3000 }).catch(() => false);
        const applyToAllVisible     = await this.loc.applyToAllUnitsBtn.isVisible({ timeout: 3000 }).catch(() => false);
        const releaseWithScopesVisible = await this.loc.releaseWithScopesBtn.isVisible({ timeout: 3000 }).catch(() => false);
        const closeVisible          = await this.loc.closeReleaseDialogBtn.isVisible({ timeout: 3000 }).catch(() => false);

        // Capture all button CTA texts inside dialog
        const dialogBtnTexts = await dialog.getByRole('button').allTextContents();
        const dialogBtns     = dialogBtnTexts.map(t => t.trim()).filter(Boolean);

        Logger.info(`[UnitInterior] Dialog title: "${title}"`);
        Logger.info(`[UnitInterior] Dialog subtitle: "${subtitle}"`);
        Logger.info(`[UnitInterior] Dialog table headers: ${JSON.stringify(tableHeaders)}`);
        Logger.info(`[UnitInterior] Dialog table rows: ${tableRowCount}`);
        Logger.info(`[UnitInterior] Dialog buttons: ${JSON.stringify(dialogBtns)}`);
        Logger.info(`[UnitInterior] "Select all scopes" visible: ${selectAllVisible}`);
        Logger.info(`[UnitInterior] "Apply same Scope to all Units" visible: ${applyToAllVisible}`);
        Logger.info(`[UnitInterior] "Release with Scopes" visible: ${releaseWithScopesVisible}`);
        Logger.info(`[UnitInterior] "Close" visible: ${closeVisible}`);

        return {
            title, subtitle, tableHeaders, tableRowCount,
            dialogBtns,
            selectAllVisible, applyToAllVisible, releaseWithScopesVisible, closeVisible,
        };
    }

    /**
     * Returns checked/unchecked state for a unit–scope checkbox in the dialog.
     * @param {number} unitNumber
     * @param {string} scopeName  e.g. 'Bid with material'
     */
    async getScopeCheckboxState(unitNumber, scopeName) {
        const label   = `${unitNumber} — ${scopeName}`;
        const checked = await this.loc.dialogScopeCheckbox(label)
            .isChecked({ timeout: 5000 })
            .catch(() => null);
        Logger.info(`[UnitInterior] Scope checkbox "${label}": checked=${checked}`);
        return checked;
    }

    /** Clicks "Apply same Scope to all Units" inside the open dialog. */
    async clickApplyToAllUnits() {
        Logger.info('[UnitInterior] Clicking "Apply same Scope to all Units"');
        InteractionLogger.logButtonClick('Apply same Scope to all Units', 'Apply same Scope to all Units');
        await expect(this.loc.applyToAllUnitsBtn).toBeVisible({ timeout: 8000 });
        await this.loc.applyToAllUnitsBtn.click();
        await this.page.waitForTimeout(1000);
        Logger.success('[UnitInterior] "Apply same Scope to all Units" clicked');
    }

    /**
     * Re-releases a unit back to "Released" state via the Release Units dialog.
     * When the unit was previously de-released, the dialog opens with no scopes
     * checked and "Release with Scopes" is disabled.  We click "Select all scopes"
     * to enable it before proceeding.
     * @param {number} unitNumber
     */
    async restoreUnitToReleased(unitNumber) {
        Logger.info(`[UnitInterior] Restoring unit ${unitNumber} to Released via Release Units dialog`);
        await this.selectUnit(unitNumber);
        await this.clickReleaseUnitsButton();

        // When no scope checkboxes are pre-selected, "Release with Scopes" is disabled.
        // The "Select all scopes" checkbox may be in indeterminate state — one click moves
        // it to UNCHECKED; a second click then moves it to CHECKED and enables the button.
        const releaseBtn = this.loc.releaseWithScopesBtn;
        const btnEnabled = await releaseBtn.isEnabled({ timeout: 3000 }).catch(() => false);
        if (!btnEnabled) {
            Logger.info(`[UnitInterior] restoreUnitToReleased: "Release with Scopes" disabled — enabling scopes`);
            const selectAllCb = this.loc.selectAllScopesCheckbox;

            // Click up to 3 times until the checkbox is checked and button is enabled
            for (let attempt = 0; attempt < 3; attempt++) {
                const isChecked = await selectAllCb.isChecked({ timeout: 2000 }).catch(() => false);
                const isBtnOk   = await releaseBtn.isEnabled({ timeout: 1000 }).catch(() => false);
                if (isChecked || isBtnOk) break;
                Logger.info(`[UnitInterior] restoreUnitToReleased: clicking "Select all scopes" (attempt ${attempt + 1})`);
                await selectAllCb.click().catch(() => {});
                await this.page.waitForTimeout(600);
            }

            // Fallback: check individual scope checkboxes inside the dialog table
            const stillDisabled = !(await releaseBtn.isEnabled({ timeout: 2000 }).catch(() => false));
            if (stillDisabled) {
                Logger.info('[UnitInterior] restoreUnitToReleased: selecting individual scope checkboxes');
                const scopeCbs = this.page.getByRole('dialog').locator('table input[type="checkbox"]');
                const total = await scopeCbs.count().catch(() => 0);
                for (let i = 0; i < total; i++) {
                    const cb = scopeCbs.nth(i);
                    if (!(await cb.isChecked().catch(() => false))) {
                        await cb.click().catch(() => {});
                        await this.page.waitForTimeout(300);
                    }
                }
            }

            // Final assertion — if still disabled, test will fail with a clear message
            await expect(releaseBtn, '"Release with Scopes" must be enabled after selecting scopes').toBeEnabled({ timeout: 10000 });
        }

        await this.performReleaseWithScopes();
        await this.clearAllSelections();
        await this.page.waitForTimeout(500);
        const status = await this.getUnitStatus(unitNumber);
        Logger.success(`[UnitInterior] Unit ${unitNumber} restored — current status: "${status}"`);
        return status;
    }

    /** Clicks "Release with Scopes" and waits for the dialog to disappear. */
    async performReleaseWithScopes() {
        Logger.info('[UnitInterior] Clicking Release with Scopes');
        await expect(this.loc.releaseWithScopesBtn).toBeVisible({ timeout: 10000 });
        InteractionLogger.logButtonClick('Release with Scopes', 'Release with Scopes');
        await this.loc.releaseWithScopesBtn.click();
        await this.loc.releaseUnitsDialog
            .waitFor({ state: 'hidden', timeout: 20000 })
            .catch(() => Logger.info('[UnitInterior] Dialog already closed'));
        await this.page.waitForTimeout(2000);
        Logger.success('[UnitInterior] Release with Scopes completed');
    }

    /** Closes the dialog via the X button without releasing. */
    async closeReleaseDialog() {
        await this.loc.closeReleaseDialogBtn.click().catch(() => {});
        await this.loc.releaseUnitsDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        Logger.info('[UnitInterior] Release dialog closed via Close button');
    }

    // ── Filter panel operations ───────────────────────────────────────────

    /** Clicks the Filter button to open the filter panel and waits for it to appear. */
    async openFilterPanel() {
        Logger.info('[UnitInterior] Opening filter panel');
        await this.loc.filterButton.waitFor({ state: 'visible', timeout: 10000 });
        await this.loc.filterButton.click();
        await this.loc.filterDialog.waitFor({ state: 'visible', timeout: 8000 });
        Logger.success('[UnitInterior] Filter panel open');
    }

    /**
     * Reads all available options for a named filter.
     * Opens filter panel if not already open, clicks the filter textbox so the listbox
     * appears, reads option texts, then presses Escape to close everything.
     * Panel will be CLOSED after this returns — caller must reopen for subsequent filter actions.
     * @param {'Status'|'FP Type'|'Unit Type'} filterName
     * @returns {Promise<string[]>}
     */
    async getAvailableFilterOptions(filterName) {
        Logger.info(`[UnitInterior] Reading available options for filter "${filterName}"`);
        const isOpen = await this.loc.filterDialog.isVisible({ timeout: 500 }).catch(() => false);
        if (!isOpen) await this.openFilterPanel();

        const textboxMap = {
            'Status':    this.loc.filterStatusInput,
            'FP Type':   this.loc.filterFpTypeInput,
            'Unit Type': this.loc.filterUnitTypeInput,
        };
        const listboxMap = {
            'Status':    this.loc.filterStatusListbox,
            'FP Type':   this.loc.filterFpTypeListbox,
            'Unit Type': this.loc.filterUnitTypeListbox,
        };

        const textbox = textboxMap[filterName];
        const listbox = listboxMap[filterName];
        if (!textbox || !listbox) throw new Error(`Unknown filter name: "${filterName}"`);

        await textbox.click();
        await listbox.waitFor({ state: 'visible', timeout: 8000 });
        const options = await listbox.getByRole('option').allTextContents();
        const cleaned = options.map(o => o.trim()).filter(Boolean);
        Logger.info(`[UnitInterior] Filter "${filterName}" options: ${JSON.stringify(cleaned)}`);

        // Escape closes the listbox (and possibly the whole panel) — either is acceptable
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
        return cleaned;
    }

    /**
     * Applies a single filter value:
     *   1. Opens filter panel if not already open
     *   2. Clicks the filter textbox to open its listbox
     *   3. Clicks the given option
     *   4. Presses Escape to close the filter panel
     * @param {'Status'|'FP Type'|'Unit Type'} filterName
     * @param {string} optionText
     */
    async applyFilterValue(filterName, optionText) {
        Logger.info(`[UnitInterior] Applying filter: ${filterName} = "${optionText}"`);
        InteractionLogger.logInteraction('filter', filterName, optionText);

        const isOpen = await this.loc.filterDialog.isVisible({ timeout: 500 }).catch(() => false);
        if (!isOpen) await this.openFilterPanel();

        const textboxMap = {
            'Status':    this.loc.filterStatusInput,
            'FP Type':   this.loc.filterFpTypeInput,
            'Unit Type': this.loc.filterUnitTypeInput,
        };
        const listboxMap = {
            'Status':    this.loc.filterStatusListbox,
            'FP Type':   this.loc.filterFpTypeListbox,
            'Unit Type': this.loc.filterUnitTypeListbox,
        };

        const textbox = textboxMap[filterName];
        const listbox = listboxMap[filterName];
        if (!textbox || !listbox) throw new Error(`Unknown filter name: "${filterName}"`);

        await textbox.click();
        await listbox.waitFor({ state: 'visible', timeout: 8000 });
        await listbox.getByRole('option', { name: optionText, exact: true }).click();
        await this.page.waitForTimeout(600);

        // Close the filter panel
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);
        Logger.success(`[UnitInterior] Filter applied: ${filterName} = "${optionText}"`);
    }

    /**
     * Clears all active filters via the "Clear all" button.
     * Opens filter panel if not already open.
     * Uses JS evaluate to click in case the button is outside the visible viewport.
     */
    async clearAllFilterValues() {
        Logger.info('[UnitInterior] Clearing all filter values');
        const isOpen = await this.loc.filterDialog.isVisible({ timeout: 500 }).catch(() => false);
        if (!isOpen) await this.openFilterPanel();

        await this.loc.clearAllFiltersBtn.waitFor({ state: 'visible', timeout: 5000 });
        // JS click handles cases where the button is positioned above the visible viewport
        await this.loc.clearAllFiltersBtn.evaluate(btn => btn.click());
        await this.page.waitForTimeout(600);

        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);
        Logger.success('[UnitInterior] All filters cleared');
    }

    /**
     * Returns the number of grid rows that are currently VISIBLE on screen.
     * RevoGrid keeps filtered-out rows in the DOM (hidden via CSS) so the regular
     * allGridRows.count() includes them. This method checks isVisible() per row.
     * @returns {Promise<number>}
     */
    async getVisibleGridRowCount() {
        const rows = this.loc.allGridRows;
        const total = await rows.count();
        let visible = 0;
        for (let i = 0; i < total; i++) {
            if (await rows.nth(i).isVisible({ timeout: 0 }).catch(() => false)) visible++;
        }
        Logger.info(`[UnitInterior] Visible grid rows: ${visible} (DOM total: ${total})`);
        return visible;
    }

    /**
     * Returns the rendered text value at a specific column index for every VISIBLE data row.
     * Skips rows that RevoGrid has hidden after a filter is applied.
     * Uses element.innerText to avoid Mantine injected <style> content.
     * Column indices: 0=toggle, 1=checkbox, 2=Unit, 3=FP Type, 4=Unit Type, 5=Status
     * @param {number} colIndex
     * @returns {Promise<string[]>}
     */
    async getColumnValuesFromAllRows(colIndex) {
        const rows = this.loc.allGridRows;
        const total = await rows.count();
        const values = [];
        for (let i = 0; i < total; i++) {
            const row = rows.nth(i);
            // RevoGrid may keep filtered rows in DOM — skip invisible ones
            if (!(await row.isVisible({ timeout: 0 }).catch(() => false))) continue;
            const cell = row.getByRole('gridcell').nth(colIndex);
            const text = await cell
                .evaluate(el => (el.innerText || el.textContent || '').trim())
                .catch(() => '');
            values.push(text);
        }
        Logger.info(`[UnitInterior] Column[${colIndex}] visible values (${values.length}): ${JSON.stringify(values)}`);
        return values;
    }
}

module.exports = { UnitInteriorPage, JOB_NAME, JOB_ID };
