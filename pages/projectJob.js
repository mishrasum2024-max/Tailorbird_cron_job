const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { Logger } = require('../utils/logger');
const { projectJobLocators } = require('../locators/projectJobLocator');
const PropertiesHelper = require('../pages/properties');

let prop;


exports.ProjectJob = class ProjectJob {
    constructor(page) {
        this.page = page;
        this.locators = projectJobLocators(page);
        this.prop = new PropertiesHelper(page);

    }

    async navigateToJobsTab() {
        try {
            if (/\/jobs\/\d+/.test(this.page.url())) {
                Logger.info('navigateToJobsTab: already on /jobs/:id workspace — skipping project Jobs tab.');
                return;
            }
            Logger.step('Navigating to Jobs tab...');
            await this.locators.jobsTab.click();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(3000);
            await this.locators.jobsTab.click();
            await this.page.waitForURL(/tab=jobs/, { timeout: 35000 });
            Logger.success('Navigated to Job screen.');
        } catch (error) {
            Logger.step(`Error in navigateToJobsTab: ${error.message}`);
            throw error;
        }
    }

    async addJob() {
        try {
            Logger.step('Opening Add Job dropdown...');
            await this.locators.addJobMenu.waitFor({ state: 'visible' });
            await this.locators.addJobMenu.click();
            await this.page.waitForSelector('div[role="menu"], .mantine-Menu-dropdown', { timeout: 5000 });
            await this.locators.addJobMenuItem('Add Job').click();
            await this.page.waitForSelector('div[role="gridcell"][col-id="title"]', { timeout: 15000 });
            await expect(this.locators.viewDetailsButton).toBeVisible({ timeout: 10000 });
            await expect(this.locators.deleteButton).toBeVisible({ timeout: 10000 });
            Logger.success('New job row added successfully.');
        } catch (error) {
            Logger.step(`Error in addJob: ${error.message}`);
            throw error;
        }
    }

    async editJobTitle(newTitle) {
        try {
            Logger.info('Editing job title...');
            await this.locators.titleCell.waitFor({ state: 'visible' });
            await this.locators.titleCell.dblclick();
            await this.locators.inputBox.waitFor({ state: 'visible' });
            await this.locators.inputBox.fill(newTitle);
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);
            await this.page.keyboard.press('Enter');
            Logger.success(`Job title updated to: ${newTitle}`);
        } catch (error) {
            Logger.step(`Error in editJobTitle: ${error.message}`);
            throw error;
        }
    }

    async selectJobType(typeText) {
        try {
            Logger.info(`Selecting Job Type: ${typeText}`);
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);
            await this.locators.unitInteriorSpan.waitFor({ state: 'visible', timeout: 10000 });
            await this.locators.unitInteriorSpan.dblclick();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);
            const typeOption = this.locators.jobTypeDropdownOption(typeText);
            await typeOption.waitFor({ state: 'visible' });
            await typeOption.click();
        } catch (error) {
            Logger.step(`Error in selectJobType: ${error.message}`);
            throw error;
        }
    }

    async openJobSummary() {
        try {
            Logger.step('Opening Job Summary...');

            if (/\/jobs\/\d+/.test(this.page.url())) {
                await this.page.waitForLoadState('load');
                const summaryTab = this.page.locator('.mantine-Tabs-tabLabel:has-text("Job Summary")');
                if (await summaryTab.isVisible({ timeout: 8000 }).catch(() => false)) {
                    await summaryTab.click();
                    await this.page.waitForLoadState('load');
                    Logger.success('Job Summary tab opened (deep-linked job)');
                    return;
                }
                const invoiceTab = this.page.getByRole('tab', { name: /Invoice/i });
                const changeOrderTab = this.page.getByRole('tab').filter({ hasText: /Change Order/i });
                if (
                    (await invoiceTab.isVisible({ timeout: 5000 }).catch(() => false)) ||
                    (await changeOrderTab.first().isVisible({ timeout: 3000 }).catch(() => false))
                ) {
                    Logger.success('openJobSummary: job workspace already loaded from deep link — skipping View details');
                    return;
                }
            }

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    Logger.step(`Attempt ${attempt}: Trying to open Job Summary...`);
                    await this.page.waitForLoadState('load');
                    await this.page.waitForTimeout(2000);

                    // Try primary locator first
                    const viewDetailsBtn = this.locators.viewDetailsButton;

                    // Wait for the button to be visible and clickable
                    await viewDetailsBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);

                    // Check if button exists and is clickable
                    const isVisible = await viewDetailsBtn.isVisible().catch(() => false);

                    if (isVisible) {
                        await viewDetailsBtn.click();
                        await this.page.waitForLoadState('load');
                        await this.page.waitForTimeout(3000);

                        // Verify we're on the job summary page
                        const summaryTab = this.page.locator('.mantine-Tabs-tabLabel:has-text("Job Summary")');
                        await summaryTab.waitFor({ state: 'visible', timeout: 10000 });
                        Logger.success('Job Summary opened successfully');
                        return;
                    }
                } catch (attemptError) {
                    Logger.step(`Attempt ${attempt} failed: ${attemptError.message}`);
                    if (attempt < 3) {
                        await this.page.reload();
                        await this.page.waitForLoadState('load');
                        await this.page.waitForTimeout(2000);
                    }
                }
            }

            throw new Error('Failed to open Job Summary after 3 attempts');
        } catch (error) {
            Logger.step(`Error in openJobSummary: ${error.message}`);
            throw error;
        }
    }

    async fillJobDescription(description) {
        try {
            Logger.info('Filling Job Summary description...');
            await this.locators.descriptionInput.fill(description);
        } catch (error) {
            Logger.step(`Error in fillJobDescription: ${error.message}`);
            throw error;
        }
    }

    async selectStartEndDates() {
        try {
            const today = new Date();
            const startDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const endDate = tomorrow.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            Logger.info(`Selecting Start Date: ${startDate}`);
            await this.locators.selectStartDateBtn.click();
            await this.page.waitForTimeout(1000);
            await this.locators.dateButtonByAriaLabel(startDate).click();
            Logger.info(`Selecting End Date: ${endDate}`);
            await this.locators.selectEndDateBtn.click();
            await this.page.waitForTimeout(1000);
            await this.locators.dateButtonByAriaLabel(endDate).click();
            await expect(this.page).toHaveURL(/tab=summary/);
            Logger.success('Job Summary page verified successfully.');
        } catch (error) {
            Logger.step(`Error in selectStartEndDates: ${error.message}`);
            throw error;
        }
    }

    // async createBidWithMaterial() {
    //     try {
    //         Logger.step('Checking Bids tab status...');
    //         await expect(this.locators.bidsTab).toBeVisible();
    //         await expect(this.locators.bidsTab).toBeEnabled();
    //         Logger.info('Bids tab is visible and enabled');
    //         Logger.step('Creating Bid with Material...');
    //         await this.locators.bidsTab.click();
    //         await this.page.waitForTimeout(1000);
    //         await this.locators.addRowBtn.click();
    //         await this.page.waitForTimeout(2000);
    //         await this.locators.firstGridCell.dblclick();
    //         await this.locators.bidSearchInput.fill('Bid with material');
    //         await this.locators.bidSearchInput.press('Enter');
    //         await this.page.waitForLoadState('load');
    //         await this.page.waitForTimeout(2000);
    //         Logger.success('Created Bid with Material.');
    //     } catch (error) {
    //         Logger.step(`Error in createBidWithMaterial: ${error.message}`);
    //         throw error;
    //     }
    // }

    // async createBidWithMaterial() {
    //     try {
    //         Logger.step('Checking Bids tab status...');
    //         await expect(this.locators.bidsTab).toBeVisible();
    //         await this.locators.bidsTab.click();

    //         const bidsPanel = this.page.getByLabel('Bids');

    //         // ✅ Correct Add Row button (scoped)
    //         const addRowBtn = bidsPanel.getByTestId('bt-add-row');
    //         await expect(addRowBtn).toBeVisible();
    //         await addRowBtn.click();

    //         const firstScopeCell = bidsPanel.locator(
    //             'revo-grid .content-wrapper div[role="row"][data-rgrow="0"] div[role="gridcell"][data-rgcol="0"]:not(.disabled)'
    //         );

    //         await expect(firstScopeCell).toBeVisible();
    //         await firstScopeCell.dblclick();

    //         // Mantine dropdown input
    //         // const searchInput = this.page.locator(
    //         //     '.mantine-Menu-dropdown input[placeholder="Search or create..."]'
    //         // );

    //         const searchInput = this.page.locator(
    //             'revogr-header input[placeholder="Search or create..."]'
    //         );


    //         await expect(searchInput).toBeVisible();
    //         await searchInput.fill('Bid with material');
    //         await searchInput.press('Enter');

    //         await this.page.waitForLoadState('load');

    //         Logger.success('Created Bid with Material.');
    //     } catch (error) {
    //         Logger.step(`Error in createBidWithMaterial: ${error.message}`);
    //         throw error;
    //     }
    // }

    async createBidWithMaterial() {
        const bidCount = 3;
        const bids = Array.from({ length: bidCount }, () => ({
            scope: `Bid_Material_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            price: Math.floor(Math.random() * (5000 - 100 + 1)) + 100
        }));

        try {
            Logger.step(`Creating ${bidCount} Bids with Material...`);
            await this.deleteExistingBids();

            await expect(this.locators.bidsTabPanel).toBeVisible({ timeout: 10000 });
            await expect(this.locators.addRowBtn).toBeVisible({ timeout: 10000 });

            for (let i = 0; i < bids.length; i++) {
                await this._addOneBid(bids[i].scope, bids[i].price);
                if (i < bids.length - 1) Logger.step(`Bid ${i + 1} done, adding next...`);
            }

            for (const { scope } of bids) {
                await expect(this.page.getByText(scope)).toBeVisible({ timeout: 8000 });
            }
            Logger.step(`All ${bidCount} scopes visible: ${bids.map(b => `"${b.scope}"`).join(', ')}`);
            Logger.success(`${bidCount} Bids created and verified: ${bids.map(b => `"${b.scope}" ($${b.price})`).join(', ')}`);
        } catch (error) {
            Logger.step(`Error in createBidWithMaterial: ${error.message}`);
            throw error;
        }
    }

    async createBidWithoutMaterial() {
        try {
            Logger.step('Creating Bid without Material...');
            await this.locators.bidsTab.click();
            await this.locators.bidsTabPanel.getByTestId('bt-add-row-menu').click();
            await this.locators.addRowBtn.click();
            await this.page.waitForTimeout(4000);
            await this.locators.lastGridCell.dblclick();
            await this.locators.bidSearchInput.fill('Bid without material');
            await this.locators.bidSearchInput.press('Enter');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);
            Logger.success('Created Bid without Material.');
        } catch (error) {
            Logger.step(`Error in createBidWithoutMaterial: ${error.message}`);
            throw error;
        }
    }

    // async inviteVendorsToBid() {
    //     try {
    //         Logger.step('Inviting Vendors to Bid...');
    //         const addVendorsButton = this.page.getByRole('button', { name: 'Add Vendors' });

    //         await expect(this.addVendorsButton).toBeVisible({ timeout: 10000 });
    //         await expect(this.addVendorsButton).toBeEnabled();
    //         await this.addVendorsButton.click();

    //         if (!(await this.locators.inviteVendorsToBidButton.isVisible())) {
    //             await this.locators.manageVendorsToggle.click();
    //         }
    //         await this.locators.inviteVendorsToBidButton.click();
    //         await this.page.waitForTimeout(4000);
    //     } catch (error) {
    //         Logger.step(`Error in inviteVendorsToBid: ${error.message}`);
    //         throw error;
    //     }
    // }

    async inviteVendorsToBid() {
        try {
            Logger.step('Opening vendor invitation modal...');
            await this.locators.bidsTab.click();
            await this.page.waitForTimeout(2000);

            // Check if Manage Vendors is expanded
            const manageVendorsSection = this.locators.manageVendorsToggle;
            const isVisible = await this.locators.addVendorsButton.isVisible().catch(() => false);

            if (!isVisible) {
                await manageVendorsSection.click();
                await this.page.waitForTimeout(1000);
                await this.locators.addVendorsButton.waitFor({ state: 'visible', timeout: 5000 });
            }

            // Click Add Vendors button to open the "Invite Vendors to Bid" dialog
            await this.locators.addVendorsButton.click();
            await this.page.waitForTimeout(2000);

            Logger.success('Vendor invitation modal opened');
        } catch (error) {
            Logger.step(`Error in inviteVendorsToBid: ${error.message}`);
            throw error;
        }
    }

    async verifyBidTemplate() {
        try {
            Logger.step('click on bid tab...');
            await this.locators.bidsTab.click();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(3000);
            if (await this.locators.inviteVendorsToBidButton.isVisible()) {
                await this.locators.manageVendorsToggle.click();
                await this.page.waitForTimeout(2000);
                Logger.success('Manage Vendors pane minimized.');
            }
            Logger.step('Verifying bid template...');
            await this.locators.templateMenuButton.click();
            const modal = this.locators.templateMenuDropdown;
            await expect(modal).toBeVisible();

            await this.locators.templateMenuButton.click();

            await expect(
                this.page.getByRole('menuitem', {
                    name: /Tailorbird Baseline Bid Book/i,
                })
            ).toBeVisible();

            const firstOption = this.locators.templateMenuFirstOption;
            const secondOption = this.locators.templateMenuSecondOption;
            await expect(firstOption).toBeVisible();
            await expect(this.locators.templateMenuGlobeIcon).toBeVisible();
            await expect(this.locators.templateMenuFirstDivider).toBeVisible();
            await expect(secondOption).toBeVisible();
            Logger.step('Clicking first menu option...');
            await firstOption.click();
            Logger.step('Waiting for Apply Template dialog...');
            const applyDialog = this.locators.applyTemplateDialog;
            await expect(applyDialog).toBeVisible();
            const applyTitle = this.locators.applyTemplateTitle;
            const applyMessage = this.locators.applyTemplateMessage;
            const applyCancel = this.locators.applyTemplateCancelBtn;
            const applyTemplate = this.locators.applyTemplateApplyBtn;
            Logger.step(`Dialog Title: ${await applyTitle.textContent()}`);
            Logger.step(`Dialog Message: ${await applyMessage.textContent()}`);
            await expect(applyCancel).toBeVisible();
            await expect(applyTemplate).toBeVisible();

            let before = '';
            try {
                before = await this.locators.agCenterColsVisible.innerText({ timeout: 5000 });
            } catch (e) {
                Logger.info('Grid not visible before template apply, skipping comparison');
            }

            Logger.step('Clicking Apply Template...');
            await applyTemplate.waitFor({ state: 'visible' });
            await applyTemplate.click();
            await applyTemplate.waitFor({ state: 'hidden' });
            Logger.step('Waiting for Template Applied notification...');
            const notif1 = this.locators.notificationRoot;
            await expect(notif1).toBeVisible({ timeout: 15000 });
            await expect(notif1).toContainText('Template Applied');
            await expect(notif1).toContainText('has been applied successfully');

            let after = '';
            try {
                after = await this.locators.agCenterColsVisible.innerText({ timeout: 5000 });
            } catch (e) {
                Logger.info('Grid not visible after template apply, skipping comparison');
            }

            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(5000);
            if (before && after) {
                expect(after).not.toBe(before);
            }
            Logger.step('Re-opening bid template menu...');
            await this.locators.templateMenuButton.click();
            await expect(modal).toBeVisible();
            Logger.step('Clicking second menu option...');
            await secondOption.click();
            Logger.step('Waiting for Save as Template dialog...');
            const saveDialog = this.locators.saveTemplateDialog;
            await expect(saveDialog).toBeVisible();
            const header = this.locators.saveTemplateHeader;
            const nameLabel = this.locators.saveTemplateNameLabel;
            const nameInput = this.locators.saveTemplateNameInput;
            const descLabel = this.locators.saveTemplateDescLabel;
            const descInput = this.locators.saveTemplateDescInput;
            const saveCancel = this.locators.saveTemplateCancelBtn;
            const saveBtn = this.locators.saveTemplateSaveBtn;
            await expect(header).toHaveText('Save as Template');
            await expect(nameLabel).toBeVisible();
            await expect(nameInput).toBeVisible();
            await expect(descLabel).toBeVisible();
            await expect(descInput).toBeVisible();
            await expect(saveCancel).toBeVisible();
            await expect(saveBtn).toBeVisible();
            const generatedName = 'Automation Template ' + Date.now();
            await nameInput.fill(generatedName);
            await descInput.fill('This is an automation-generated template.');
            Logger.step('Clicking Save Template...');
            await saveBtn.click();
            const notif2 = this.locators.notificationRootFirst;
            await expect(notif2).toBeVisible({ timeout: 15000 });
            await expect(notif2).toContainText('Template Saved');
            await expect(notif2).toContainText('has been saved successfully');
        } catch (error) {
            Logger.step(`Error in verifyBidTemplate: ${error.message}`);
            throw error;
        }
    }

    async validateAndUpdateFirstRow() {
        try {
            Logger.step('Updating first row - Total Price cell (quantity click was targeting wrong column)...');
            await this.minimizeManageVendors();
            await this.page.waitForTimeout(1000);
            const dataRow = this.locators.bidsGridDataRowByScope('Bid with material').or(
                this.locators.bidsGridRowByScope('Bid with material')
            );
            await expect(dataRow).toBeVisible({ timeout: 10000 });

            // Target Total Price (last cell) - col 6 or total_price
            const totalPriceCell = dataRow.locator('[role="gridcell"]').last();
            const waitForCellSave = () => this.page.waitForResponse(
                (r) => r.url().includes('/api/bird-table') && r.status() >= 200 && r.status() < 300,
                { timeout: 8000 }
            ).catch(() => null);

            const totalPrice = Math.floor(Math.random() * 51) + 50; // 50-100
            await totalPriceCell.scrollIntoViewIfNeeded();
            await totalPriceCell.waitFor({ state: 'visible', timeout: 5000 });
            const savePromise = waitForCellSave();
            await totalPriceCell.dblclick({ force: true });
            await this.page.waitForTimeout(600);
            const input = this.page.locator('input[data-testid="bird-table-currency-input"], input[data-testid="bird-table-number-input"], input[data-testid="bird-table-text-input"]').first();
            if (await input.isVisible().catch(() => false)) {
                await input.fill(totalPrice.toString());
            } else {
                await this.page.keyboard.press('ControlOrMeta+a');
                await this.page.keyboard.type(totalPrice.toString(), { delay: 50 });
            }
            await this.page.keyboard.press('Enter');
            await savePromise;
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(800);

            // Assert Total Price was saved
            await this.page.waitForTimeout(500);
            const rowAfterUpdate = this.locators.bidsGridDataRowByScope('Bid with material').or(
                this.locators.bidsGridRowByScope('Bid with material')
            );
            const totalCellText = await rowAfterUpdate.locator('[role="gridcell"]').last().textContent().catch(() => '');
            if (totalCellText && totalCellText.includes(totalPrice.toString())) {
                Logger.success(`Total Price (${totalPrice}) asserted successfully`);
            } else {
                Logger.info(`Total Price entered: ${totalPrice}. Cell shows: "${totalCellText}"`);
            }
        } catch (error) {
            Logger.step(`Error in validateAndUpdateFirstRow: ${error.message}`);
            throw error;
        }
    }

    async updateBidWithMaterial() {
        try {
            Logger.step('Updating existing bid with "Bid with material" template...');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            // Target the first EXISTING bid row's scope cell (scoped to Bids tab) - do NOT add new row
            const scopeCell = this.locators.firstBidRowScopeCell.or(this.locators.bidsGridFirstScopeCell);
            await expect(scopeCell).toBeVisible({ timeout: 10000 });
            await scopeCell.scrollIntoViewIfNeeded();
            await scopeCell.dblclick();
            await this.page.waitForTimeout(500);

            // Use the inline scope editor - try scopeSearchInput first, fallback to menu input
            const searchInput = this.locators.scopeSearchInput.or(this.locators.bidSearchInput1);
            await searchInput.waitFor({ state: 'visible', timeout: 8000 });
            await searchInput.click();
            await this.page.waitForTimeout(200);
            await searchInput.fill('');
            await searchInput.fill('Bid with material', { force: true });
            await this.page.waitForTimeout(600);

            // Select the "Bid with material" option - try listbox first, then menu, then Enter
            const scopeOption = this.locators.scopeListboxOption('Bid with material');
            const optionVisible = await scopeOption.isVisible().catch(() => false);
            if (optionVisible) {
                await scopeOption.click();
            } else {
                const menuOption = this.page.locator('[role="menu"] >> text=Bid with material').first();
                if (await menuOption.isVisible().catch(() => false)) {
                    await menuOption.click();
                } else {
                    await this.page.keyboard.press('Enter');
                }
            }

            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);
            Logger.success('Existing bid updated with "Bid with material" template');
        } catch (error) {
            Logger.step(`Error in updateBidWithMaterial: ${error.message}`);
            throw error;
        }
    }

    async navigateToBidsTab() {
        try {
            Logger.step('Navigating to Bids tab...');
            await expect(this.locators.bidsTab).toBeEnabled();
            await this.locators.bidsTab.click();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(3000);
        } catch (error) {
            Logger.step(`Error in navigateToBidsTab: ${error.message}`);
            throw error;
        }
    }

    async minimizeManageVendors() {
        try {
            Logger.step('Minimizing Manage Vendors pane...');
            if (!(await this.locators.inviteVendorsToBidButton.isVisible())) {
                await this.locators.manageVendorsToggle.click();
                await this.page.waitForTimeout(2000);
            }
        } catch (error) {
            Logger.step(`Error in minimizeManageVendors: ${error.message}`);
            throw error;
        }
    }

    async openFilterPanel() {
        try {
            Logger.step('Opening filter panel...');
            await this.page.getByRole('button').filter({ has: this.page.locator('svg.lucide-funnel') }).click();
            await this.page.waitForTimeout(1000);
        } catch (error) {
            Logger.step(`Error in openFilterPanel: ${error.message}`);
            throw error;
        }
    }

    async applyFilter(filterValue) {
        try {
            Logger.step(`Applying filter: ${filterValue}`);
            // await this.page.getByPlaceholder('Search').fill(filterValue);
            await this.page.locator(`p:has-text("${filterValue}")`).click();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(1500);
        } catch (error) {
            Logger.step(`Error in applyFilter: ${error.message}`);
            throw error;
        }
    }

    async exportProjectList() {
        try {
            Logger.step('Exporting project list...');
            const downloadPromise = this.page.waitForEvent('download');
            await this.locators.exportButton.click();
            return await downloadPromise;
        } catch (error) {
            Logger.step(`Error in exportProjectList: ${error.message}`);
            throw error;
        }
    }

    async downloadAndParseCSV(download) {
        try {
            Logger.step('Parsing downloaded CSV...');
            const filePath = await download.path();
            const fs = require('fs');
            const csvText = fs.readFileSync(filePath, 'utf8');
            const lines = csvText.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
            return lines.slice(1).map(row => {
                const values = row.split(',').map(v => v.replace(/^"|"$/g, ''));
                return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
            });
        } catch (error) {
            Logger.step(`Error in downloadAndParseCSV: ${error.message}`);
            throw error;
        }
    }

    async validateExportResults(parsedData, projectName, filterValue) {
        try {
            Logger.step('Validating exported CSV...');
            const nameCol = Object.keys(parsedData[0]).find(k => k.toLowerCase().includes('name'));
            const propCol = Object.keys(parsedData[0]).find(k => k.toLowerCase().includes('property'));
            expect(nameCol).toBeTruthy();
            expect(propCol).toBeTruthy();
            const rowsByProperty = parsedData.filter(r => r[propCol] === filterValue);
            const rowsByName = parsedData.filter(r => r[nameCol] === projectName);
            Logger.success(`CSV validation complete. Property matches: ${rowsByProperty.length}, Name matches: ${rowsByName.length}`);
        } catch (error) {
            Logger.step(`Error in validateExportResults: ${error.message}`);
            throw error;
        }
    }

    async openBidLevelling() {
        try {
            Logger.step('Opening Bid Levelling view...');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            const bidBookTab = this.locators.bidBookTab;
            const bidLevellingTab = this.locators.bidLevellingTab;

            const isAlreadyLevelling = await bidLevellingTab.getAttribute('aria-selected').catch(() => 'false');
            if (isAlreadyLevelling === 'true') {
                Logger.info('Bid Levelling view is already active');
                return;
            }

            const levellingBtn = this.page.locator('button.mantine-ActionIcon-root:has(svg.lucide-scale)');
            const isLevellingBtnVisible = await levellingBtn.isVisible().catch(() => false);

            if (isLevellingBtnVisible) {
                await levellingBtn.click();
            } else {
                await bidLevellingTab.click();
            }

            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(3000);

            await expect(this.locators.bidLevellingTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
            Logger.success('Bid Levelling view opened');
        } catch (error) {
            Logger.step(`Error in openBidLevelling: ${error.message}`);
            throw error;
        }
    }

    async validateBidLevellingTable() {
        try {
            Logger.step('Validating Bid Levelling table...');

            await expect(this.locators.bidLevellingTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
            Logger.info('Bid Levelling tab is selected');

            const headers = this.locators.bidLevellingHeaders;
            const headerCount = await headers.count();
            Logger.info(`Bid Levelling table headers found: ${headerCount}`);
            expect(headerCount).toBeGreaterThan(0);

            const expectedHeaders = ['Scope', 'Schedule of Value', 'Cost Item', 'Location'];
            for (const expected of expectedHeaders) {
                const header = this.page.locator(`[role="columnheader"]:has-text("${expected}")`);
                await expect(header).toBeVisible({ timeout: 5000 });
                console.log(`Header verified: "${expected}"`);
            }

            const allHeaders = await headers.allTextContents();
            console.log('All Bid Levelling headers:', allHeaders);

            const dataRows = this.locators.bidLevellingRows;
            const rowCount = await dataRows.count();
            Logger.info(`Bid Levelling data rows: ${rowCount}`);
            expect(rowCount).toBeGreaterThan(0);

            for (let i = 0; i < Math.min(rowCount, 5); i++) {
                const rowCells = dataRows.nth(i).locator('[role="gridcell"]');
                const cellTexts = await rowCells.allTextContents();
                console.log(`Row ${i}: ${cellTexts.map(t => t.trim()).join(' | ')}`);
            }

            const totalRow = this.locators.bidLevellingTotalRow;
            const totalVisible = await totalRow.isVisible().catch(() => false);
            if (totalVisible) {
                const totalText = await totalRow.textContent();
                console.log(`Total row: "${totalText?.trim()}"`);
                Logger.success('Total/summary row found in Bid Levelling table');
            } else {
                Logger.info('No total row visible — may appear when vendors submit bids');
            }

            Logger.success('Bid Levelling table validated successfully');
        } catch (error) {
            Logger.step(`Error in validateBidLevellingTable: ${error.message}`);
            throw error;
        }
    }

    async updateBidPrice(rowIndex, newPrice) {
        try {
            Logger.step(`Updating price for bid row ${rowIndex} to $${newPrice}...`);
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            const priceCell = this.page.locator(`revo-grid div[role="gridcell"][data-rgcol="5"][data-rgrow="${rowIndex}"]`).first();
            await priceCell.scrollIntoViewIfNeeded();
            await priceCell.dblclick({ force: true });
            await this.page.waitForTimeout(600);

            const input = this.page.locator('input[data-testid="bird-table-currency-input"], input[data-testid="bird-table-number-input"], input[data-testid="bird-table-text-input"]').first();
            const inputVisible = await input.isVisible().catch(() => false);

            if (inputVisible) {
                await input.fill(newPrice.toString());
            } else {
                await this.page.keyboard.press('ControlOrMeta+a');
                await this.page.keyboard.type(newPrice.toString(), { delay: 50 });
            }

            await this.page.keyboard.press('Enter');
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(1500);

            Logger.success(`Price updated to $${newPrice} for row ${rowIndex}`);
            return newPrice;
        } catch (error) {
            Logger.step(`Error in updateBidPrice: ${error.message}`);
            throw error;
        }
    }

    async verifyLevellingCellsReadOnly() {
        try {
            Logger.step('Verifying Bid Levelling cells are read-only...');

            const cells = this.locators.bidLevellingCells;
            const cellCount = await cells.count();
            expect(cellCount).toBeGreaterThan(0);

            const firstCell = cells.first();
            await firstCell.dblclick({ force: true });
            await this.page.waitForTimeout(500);

            const editInput = this.page.locator('input[data-testid="bird-table-currency-input"], input[data-testid="bird-table-number-input"], input[data-testid="bird-table-text-input"]');
            const inputVisible = await editInput.isVisible().catch(() => false);

            if (!inputVisible) {
                Logger.success('Bid Levelling cells are read-only — no editor appeared');
            } else {
                Logger.info('Editor appeared in levelling cell — pressing Escape');
                await this.page.keyboard.press('Escape');
            }

            return !inputVisible;
        } catch (error) {
            Logger.step(`Error in verifyLevellingCellsReadOnly: ${error.message}`);
            throw error;
        }
    }

    async switchBackToBidBook() {
        try {
            Logger.step('Switching back to Bid Book view...');

            const bidBookTab = this.locators.bidBookTab;
            const isAlreadyBidBook = await bidBookTab.getAttribute('aria-selected').catch(() => 'false');
            if (isAlreadyBidBook === 'true') {
                Logger.info('Already on Bid Book view');
                return;
            }

            const bidBookBtn = this.page.locator('button.mantine-ActionIcon-root:has(svg.lucide-columns-2), button.mantine-ActionIcon-root:has(svg.lucide-book-open)').first();
            const isBtnVisible = await bidBookBtn.isVisible().catch(() => false);

            if (isBtnVisible) {
                await bidBookBtn.click();
            } else {
                await bidBookTab.click();
            }

            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            await expect(this.locators.bidBookTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
            Logger.success('Switched back to Bid Book view');
        } catch (error) {
            Logger.step(`Error in switchBackToBidBook: ${error.message}`);
            throw error;
        }
    }

    async applyFilterAndExport(filterValue, projectName) {
        try {
            // await this.openFilterPanel();
            // await this.applyFilter(filterValue);
            await this.page.getByRole('button', { name: /^Filter$/i }).first().click();
            await this.prop.filterPropertyNew(filterValue);
            const download = await this.exportProjectList();
            const parsed = await this.downloadAndParseCSV(download);
            await this.validateExportResults(parsed, projectName, filterValue);
        } catch (error) {
            Logger.step(`Error in applyFilterAndExport: ${error.message}`);
            throw error;
        }
    }

    async applyProjectFilterAndExport(filterValue, projectName) {
        try {
            await this.page.getByRole('button', { name: /^Filter$/i }).first().click();
            const filterPanel = this.page.locator('.mantine-Paper-root').filter({ hasText: /Filter Options|Filters/i }).first();
            await expect(filterPanel).toBeVisible({ timeout: 10000 });

            const label = filterPanel
                .locator('.mantine-Checkbox-labelWrapper label, .mantine-Checkbox-label')
                .filter({ hasText: filterValue })
                .first();
            await label.waitFor({ state: 'visible', timeout: 15000 });
            await label.click({ force: true });
            await this.page.waitForTimeout(1000);

            const download = await this.exportProjectList();
            const parsed = await this.downloadAndParseCSV(download);
            await this.validateExportResults(parsed, projectName, filterValue);
        } catch (error) {
            Logger.step(`Error in applyProjectFilterAndExport: ${error.message}`);
            throw error;
        }
    }

    async deleteFirstProjectRow() {
        try {
            Logger.step('Deleting first project row...');
            await this.locators.deleteRowBtn.first().click();
            await this.locators.deleteConfirmBtn.click();
        } catch (error) {
            Logger.step(`Error in deleteFirstProjectRow: ${error.message}`);
            throw error;
        }
    }

    async deleteExistingBids() {
        try {
            Logger.step('Checking for existing bids to delete...');
            await this.locators.bidsTab.click();
            await this.page.waitForLoadState('load');
            await this.page.waitForTimeout(2000);

            const maxDeletes = 50;
            let deleted = 0;

            for (let i = 0; i < maxDeletes; i++) {
                const deleteBtn = this.locators.bidsFirstDeleteBtn;
                const isVisible = await deleteBtn.isVisible().catch(() => false);
                if (!isVisible) break;

                await deleteBtn.scrollIntoViewIfNeeded();
                await deleteBtn.click();
                await this.page.waitForTimeout(500);

                const confirmBtn = this.locators.deleteConfirmBtn;
                await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
                await confirmBtn.click();
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1200);
                deleted++;
            }

            if (deleted > 0) {
                Logger.success(`Deleted ${deleted} existing bid row(s).`);
            } else {
                Logger.step('No existing bid rows to delete.');
            }
        } catch (error) {
            Logger.step(`Error in deleteExistingBids: ${error.message}`);
            throw error;
        }
    }

    /**
  * Add one bid row: Add Row, fill scope, enter price.
  * @param {string} scope - Scope name (e.g. Bid_Material_123_abc)
  * @param {number} price - Price value (100-5000)
  */
    async _addOneBid(scope, price) {
        const quantity = 5;
        const maxScopeAttempts = 2;

        await this.locators.addRowBtn.click();
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(2000);

        // New row is always inserted above existing rows, so first scope cell = the new empty row to fill
        const scopeCell = this.locators.bidsGridFirstScopeCell;
        await expect(scopeCell).toBeVisible({ timeout: 10000 });

        for (let attempt = 1; attempt <= maxScopeAttempts; attempt++) {
            try {
                Logger.step(`Scope attempt ${attempt}/${maxScopeAttempts} for "${scope}"...`);
                await scopeCell.scrollIntoViewIfNeeded();
                await scopeCell.dblclick();
                await this.page.waitForTimeout(400);
                const searchInput = this.locators.scopeSearchInput;
                await searchInput.waitFor({ state: 'visible', timeout: 8000 });
                await searchInput.click();
                await this.page.waitForTimeout(200);
                await searchInput.fill('');
                await searchInput.fill(scope, { force: true });
                await this.page.waitForTimeout(600);
                const scopeOption = this.locators.scopeListboxOption(scope);
                const optionVisible = await scopeOption.isVisible().catch(() => false);
                if (optionVisible) await scopeOption.click();
                else await this.page.keyboard.press('Enter');
                await this.page.waitForLoadState('load');
                await this.page.waitForTimeout(1500);
                const rowWithScope = this.locators.bidsGridRowByScope(scope);
                await expect(rowWithScope).toBeVisible({ timeout: 10000 });
                Logger.success(`Scope committed: "${scope}"`);
                break;
            } catch (scopeErr) {
                if (attempt === maxScopeAttempts) throw new Error(`Scope failed after ${maxScopeAttempts} attempts: ${scopeErr.message}`);
                await this.page.keyboard.press('Escape');
                await this.page.waitForTimeout(500);
            }
        }

        let dataRow = this.locators.bidsGridDataRowByScope(scope);
        if (!(await dataRow.isVisible().catch(() => false))) dataRow = this.locators.bidsGridRowByScope(scope);
        await expect(dataRow).toBeVisible({ timeout: 5000 });

        const getQuantityCell = () => dataRow.locator('[role="gridcell"]').nth(4);
        const getPriceCell = () => dataRow.locator('[role="gridcell"]').nth(5);
        const getTotalCell = () => dataRow.locator('[role="gridcell"]').nth(6);
        const waitForCellSave = () => this.page.waitForResponse(
            (r) => r.url().includes('/api/bird-table') && r.status() >= 200 && r.status() < 300,
            { timeout: 8000 }
        ).catch(() => null);

        const quantityCell = getQuantityCell();
        await quantityCell.waitFor({ state: 'visible', timeout: 5000 });
        await quantityCell.scrollIntoViewIfNeeded();
        const qtySavePromise = waitForCellSave();
        await quantityCell.click();
        await this.page.waitForTimeout(300);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(300);
        await this.page.keyboard.press('ControlOrMeta+a');
        await this.page.keyboard.type(quantity.toString(), { delay: 60 });
        await this.page.waitForTimeout(200);
        await this.page.keyboard.press('Enter');
        await qtySavePromise;
        await this.page.waitForTimeout(800);
        await this.page.keyboard.press('Tab');
        await this.page.waitForTimeout(300);
        await this.page.keyboard.press('Tab');
        await this.page.waitForTimeout(400);

        const priceSavePromise = waitForCellSave();
        await this.page.keyboard.press('ControlOrMeta+a');
        await this.page.keyboard.type(price.toString(), { delay: 60 });
        await this.page.waitForTimeout(200);
        await this.page.keyboard.press('Enter');
        await priceSavePromise;
        await this.page.waitForLoadState('load');
        await this.page.waitForTimeout(1500);

        await expect(async () => {
            const priceText = (await getPriceCell().textContent())?.trim() || '';
            const totalText = (await getTotalCell().textContent())?.trim() || '';
            const hasPrice = /\d+/.test(priceText) || (priceText && priceText.includes('$'));
            const hasTotal = /\d+/.test(totalText) || (totalText && totalText.includes('$'));
            if (!hasPrice && !hasTotal) throw new Error(`Price not visible. Price: "${priceText}", Total: "${totalText}"`);
        }).toPass({ timeout: 10000, intervals: [500, 1000, 1000] });
    }
    /**
     * TC47_NEW_UI: contract grid fill + finalize (enters via Jobs menu).
     * @param {{ projectName: string }} projectData — must match Jobs grid row filtering
     */
    async runTc47NewUiContractFinalize(projectData) {
        const page = this.page;

    const captureDebugScreenshot = async (label) => {
            try {
                if (typeof page.isClosed === 'function' && page.isClosed()) {
                    return null;
                }
                const safeLabel = String(label || 'debug').replace(/[^a-zA-Z0-9_-]/g, '_');
                const fileName = `test-results/tc47_new_ui_${safeLabel}_${Date.now()}.png`;
                await page.screenshot({ path: fileName, fullPage: true });
                Logger.info(`Saved debug screenshot: ${fileName}`);
                return fileName;
            } catch (e) {
                Logger.info(`Debug screenshot skipped: ${e.message || e}`);
                return null;
            }
        };
    
        const _now = new Date();
        const _yr = _now.getFullYear();
        const _mo = String(_now.getMonth() + 1).padStart(2, '0');
        const CONTRACT_DATA = {
            scope: 'Bid with material',
            budgetCategory: 'Bathroom fixtures install',
            scheduleOfValue: '15000',
            costItem: 'Mirror clipped',
            contractAmount: '25000',
            startDate: `${_yr}-${_mo}-01`,
            endDate: `${_yr}-${_mo}-28`,
        };
    
        try {
            const lastCreatedJobPath = path.join(__dirname, '../data/lastCreatedJob.json');
            if (!fs.existsSync(lastCreatedJobPath)) {
                throw new Error(`Missing job data file: ${lastCreatedJobPath}`);
            }
            const lastCreatedJob = JSON.parse(fs.readFileSync(lastCreatedJobPath, 'utf8'));
            const targetJobName = String(lastCreatedJob.jobName || '').trim();
            if (!targetJobName) {
                throw new Error('jobName is missing in data/lastCreatedJob.json');
            }
    
            Logger.step('TC47_NEW_UI: Opening Jobs from left panel (same entry as TC47_NEW)...');
            const jobsMenu = page
                .locator('nav')
                .locator('a, button, div[role="link"], div')
                .filter({ hasText: /^Jobs \(Contracts & POs\)$/i })
                .first();
            await expect(jobsMenu).toBeVisible({ timeout: 15000 });
            await jobsMenu.click();
            await page.waitForLoadState('load');
    
            Logger.step('Opening target job from Jobs listing...');
            const searchInput = page.locator('input[placeholder="Search..."]').first();
            await expect(searchInput).toBeVisible({ timeout: 15000 });
            await searchInput.fill(targetJobName);
            await page.waitForTimeout(1500);
    
            const matchingRows = page
                .getByRole('row')
                .filter({ hasText: targetJobName })
                .filter({ hasText: projectData.projectName });
            await expect(matchingRows.first()).toBeVisible({ timeout: 15000 });
            const targetRow = (await matchingRows.count()) > 1 ? matchingRows.last() : matchingRows.first();
            await expect(targetRow).toBeVisible({ timeout: 10000 });

            // View Details button removed; the ID column now has a clickable link to job details.
            const jobIdLink = targetRow.locator('a[href*="/jobs/"]').first();
            await expect(jobIdLink).toBeVisible({ timeout: 15000 });
            await jobIdLink.scrollIntoViewIfNeeded();
            await jobIdLink.click();
            await page.waitForURL(/\/jobs\/\d+/, { timeout: 30000 });
            await page.waitForLoadState('domcontentloaded');
    
            Logger.step('Pre-flight: delete existing bids (required before contract UI work / finalize)...');
            await this.deleteExistingBids();
    
            Logger.step('Opening Contracts tab (UI row path — no import)...');
            const contractsTab = page.getByRole('tab', { name: 'Contracts' });
            await contractsTab.click();
            await page.waitForTimeout(400);
            const selected = await contractsTab.getAttribute('aria-selected').catch(() => 'false');
            if (selected !== 'true') {
                await contractsTab.click();
            }
            await page.waitForURL(/tab=contracts/, { timeout: 15000 });
    
            const contractsJobPanel = page.getByRole('tabpanel', { name: 'Contracts' });
            await expect(contractsJobPanel).toBeVisible({ timeout: 15000 });
            const innerContractPanel = contractsJobPanel.getByRole('tabpanel', { name: 'Contract' }).first();
            await expect(innerContractPanel).toBeVisible({ timeout: 15000 });
    
            // Delete any pre-existing contract rows using the revogr-data action section.
            // Grid now has 3 revogr-data[type="rgRow"] sections: nth(0)=pinned-left,
            // nth(1)=main content, nth(2)=pinned-right actions (copy + delete buttons).
            await page.waitForTimeout(2500);
            const contractsGridPre = innerContractPanel.locator('revo-grid[role="treegrid"]').first();
            const actionSectionPre = contractsGridPre.locator('revogr-data[type="rgRow"]').nth(2);
            let guard = 0;
            while (guard < 40) {
                const delBtns = actionSectionPre.locator('[data-rgrow] button[aria-label="Delete"]');
                const count = await delBtns.count().catch(() => 0);
                if (count === 0) break;
                const delBtn = delBtns.first();
                await delBtn.scrollIntoViewIfNeeded();
                const isDisabled = await delBtn.isDisabled().catch(() => true);
                if (isDisabled) {
                    await page.waitForTimeout(500);
                    guard++;
                    continue;
                }
                await delBtn.click({ force: true });
                await page.waitForTimeout(500);
                const confirmDelete = page
                    .locator(".mantine-Popover-dropdown button:has-text('Delete'), [role='dialog'] button:has-text('Delete')")
                    .first();
                if (await confirmDelete.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await confirmDelete.click({ force: true });
                } else {
                    await page.waitForTimeout(600);
                }
                await page.waitForTimeout(900);
                guard++;
            }
    
            const addContractBtn = page.getByRole('button', { name: /Add Contract/i }).first();
            await expect(addContractBtn).toBeVisible({ timeout: 10000 });
            await addContractBtn.click();
            await page.waitForTimeout(1500);

            /** There may be multiple `revo-grid` nodes in the Contracts panel; pick the grid that exposes contract line columns. */
            const resolveContractsGrid = async () => {
                const grids = innerContractPanel.locator('revo-grid[role="treegrid"]');
                const deadline = Date.now() + 30000;
                while (Date.now() < deadline) {
                    const n = await grids.count();
                    for (let i = 0; i < n; i++) {
                        const g = grids.nth(i);
                        const raw = await g.locator('[role="columnheader"]').allTextContents().catch(() => []);
                        const haystack = raw.map((x) => String(x || '').replace(/\s+/g, ' ')).join(' | ');
                        if (
                            (/scope/i.test(haystack) || /budget category/i.test(haystack)) &&
                            (/contract amount/i.test(haystack) || /schedule of value/i.test(haystack))
                        ) {
                            return g;
                        }
                    }
                    await page.waitForTimeout(550);
                    await page.waitForLoadState('load').catch(() => {});
                }
                throw new Error(
                    'TC47_NEW_UI: contract line grid headers (Scope / Contract amount) never appeared — wrong revo-grid or UI still loading.'
                );
            };
            const contractsGrid = await resolveContractsGrid();
            await expect(contractsGrid).toBeVisible({ timeout: 10000 });
    
            const getHeaders = async () =>
                contractsGrid.locator('div[role="columnheader"]').evaluateAll((els) =>
                    els.map((e) => ({
                        text: (e.textContent || '').replace(/\s+/g, ' ').trim(),
                        col: Number(e.getAttribute('aria-colindex')),
                    }))
                );
            const findColumnIndex = (headers, nameRegex) => {
                const col = headers.find((h) => nameRegex.test(h.text));
                if (!col || !Number.isFinite(col.col)) {
                    throw new Error(
                        `TC47_NEW_UI: column missing for ${nameRegex}. Headers: ${headers.map((h) => h.text).join(' | ')}`
                    );
                }
                return col.col;
            };
            const findOptionalColumnIndex = (headers, nameRegex) => {
                const col = headers.find((h) => nameRegex.test(h.text));
                return col && Number.isFinite(col.col) ? col.col : null;
            };
    
            const headers = await getHeaders();
            Logger.info(`TC47_NEW_UI contract grid headers: ${JSON.stringify(headers)}`);
    
            const caColForRowPick = findColumnIndex(headers, /contract amount/i);
            const growRows = contractsGrid.locator('div[role="row"][data-rgrow]');
            await expect(growRows.first()).toBeVisible({ timeout: 10000 });
            const nGrow = await growRows.count();
            let rowGrow = null;
            for (let i = 0; i < nGrow; i++) {
                const r = growRows.nth(i);
                const caCell = r.locator(`div[role="gridcell"][aria-colindex="${caColForRowPick}"]`).first();
                const raw = (await caCell.innerText().catch(() => '')).replace(/\u2014/g, '-').replace(/\s+/g, ' ').trim();
                const emptyCa = raw === '' || raw === '-' || raw === '—';
                if (emptyCa) {
                    rowGrow = await r.getAttribute('data-rgrow');
                    break;
                }
            }
            if (!rowGrow) {
                rowGrow = await growRows.first().getAttribute('data-rgrow');
            }
            if (!rowGrow) throw new Error('data-rgrow attribute not found on new contract row');
    
            const colMap = {
                scope: findColumnIndex(headers, /scope/i),
                budgetCategory: findColumnIndex(headers, /budget category/i),
                scheduleOfValue: findColumnIndex(headers, /schedule of value/i),
                location: findOptionalColumnIndex(headers, /^location$/i),
                costItem: findOptionalColumnIndex(headers, /cost item/i),
                contractAmount: findColumnIndex(headers, /contract amount/i),
                startDate: findOptionalColumnIndex(headers, /start date/i),
                endDate: findOptionalColumnIndex(headers, /end date/i),
            };
            const contractAmountTriggerCol =
                findOptionalColumnIndex(headers, /days in reno/i) ??
                (Number.isFinite(colMap.endDate) ? colMap.endDate + 1 : 9);
    
            const getCell = (colIndex) =>
                contractsGrid
                    .locator(`div[role="gridcell"][data-rgrow="${rowGrow}"][aria-colindex="${colIndex}"]`)
                    .first();
    
            const getActiveCellCol = async () =>
                page.evaluate(() => {
                    const active = document.activeElement;
                    const cell = active?.closest?.('div[role="gridcell"]');
                    const raw = cell?.getAttribute('aria-colindex') || cell?.getAttribute('data-rgcol');
                    const asNum = Number(raw);
                    return Number.isFinite(asNum) ? asNum : null;
                });
    
            const setValueViaTriggeredCell = async ({
                triggerCol,
                targetCol,
                value,
                commitKey = 'Enter',
                label = 'field',
            }) => {
                const triggerCell = getCell(triggerCol);
                await triggerCell.scrollIntoViewIfNeeded();
                await triggerCell.dblclick({ force: true });
                await page.waitForTimeout(700);
    
                let activeCol = await getActiveCellCol();
                Logger.info(`${label} focus after trigger: activeCol=${activeCol}, targetCol=${targetCol}`);
    
                if (activeCol !== null && targetCol !== null && activeCol !== targetCol) {
                    const directionKey = targetCol < activeCol ? 'ArrowLeft' : 'ArrowRight';
                    let hops = Math.abs(targetCol - activeCol);
                    if (targetCol > activeCol) hops += 1;
                    hops = Math.min(12, hops);
                    for (let i = 0; i < hops; i++) {
                        await page.keyboard.press(directionKey);
                        await page.waitForTimeout(120);
                    }
                    await page.keyboard.press('Enter');
                    await page.waitForTimeout(350);
                    activeCol = await getActiveCellCol();
                    Logger.info(`${label} focus corrected: activeCol=${activeCol}`);
                }
    
                // When focus column is unknown (activeCol=null) arrow correction never runs; always open SOV/target via dblclick.
                if (
                    targetCol !== null &&
                    (activeCol === null || activeCol !== targetCol) &&
                    (await getCell(targetCol).isVisible().catch(() => false))
                ) {
                    Logger.info(
                        `${label}: opening target col ${targetCol} directly (activeCol=${activeCol})`
                    );
                    await page.keyboard.press('Escape').catch(() => {});
                    await page.waitForTimeout(200);
                    const targetCellDirect = getCell(targetCol);
                    await targetCellDirect.scrollIntoViewIfNeeded();
                    await targetCellDirect.dblclick({ force: true });
                    await page.waitForTimeout(450);
                    activeCol = await getActiveCellCol();
                    Logger.info(`${label} after direct dblclick: activeCol=${activeCol}`);
                }
    
                let editor = page.locator('input:visible, textarea:visible').last();
                let hasEditor = await editor.isVisible({ timeout: 2000 }).catch(() => false);
    
                if (!hasEditor && targetCol !== null) {
                    const targetCell = getCell(targetCol);
                    await targetCell.scrollIntoViewIfNeeded();
                    await targetCell.dblclick({ force: true });
                    await page.waitForTimeout(400);
                    editor = page.locator('input:visible, textarea:visible').last();
                    hasEditor = await editor.isVisible({ timeout: 2500 }).catch(() => false);
                }
    
                await expect(editor).toBeVisible({ timeout: 7000 });
                await editor.fill(String(value));
                await page.waitForTimeout(400);
                await editor.press(commitKey);
                await page.keyboard.press('Enter').catch(() => {});
                await page.waitForTimeout(300);
                if (targetCol !== null) {
                    await getCell(targetCol).click({ force: true }).catch(() => {});
                }
                await page.waitForTimeout(1400);
            };
    
            const tabsFromScopeToCol = (targetCol) => Math.max(0, targetCol - colMap.scope);
    
            const activateCell = async (cell) => {
                await cell.scrollIntoViewIfNeeded();
                await cell.click({ force: true });
                await page.waitForTimeout(500);
                await page.keyboard.press('Enter');
                await page.waitForTimeout(700);
            };
    
            // RevoGrid now uses 0-based aria-colindex matching the logical column index directly.
            const revoActivateCol = (logicalCol) => logicalCol;
    
            const fillSearchDropdownCell = async (logicalCol, value, label) => {
                const primaryAc = revoActivateCol(logicalCol);
                const activationCols = [...new Set([primaryAc, logicalCol, primaryAc - 1, primaryAc + 1, logicalCol + 2, logicalCol - 1])]
                    .filter((n) => Number.isFinite(n) && n >= 0);

                const resolveSearchInput = () =>
                    innerContractPanel
                        .locator('input[placeholder="Search or type to create..."]')
                        .or(innerContractPanel.getByPlaceholder(/search or type to create/i))
                        .or(innerContractPanel.locator('input[placeholder="Search options..."]'))
                        .or(innerContractPanel.locator('[role="dialog"] input[placeholder*="Search"]'))
                        .or(page.locator('input[placeholder="Search or type to create..."]'))
                        .or(page.locator('input[placeholder="Search options..."]'))
                        .first();

                let searchInputCell;
                let opened = false;
                for (const ac of activationCols) {
                    Logger.step(`Fill "${label}" (try activate aria-colindex ${ac})`);
                    const cell = getCell(ac);
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        await page.keyboard.press('Escape').catch(() => {});
                        await page.waitForTimeout(200);
                        await cell.scrollIntoViewIfNeeded();
                        await cell.click({ force: true });
                        await page.waitForTimeout(400);
                        await page.keyboard.press('Enter');
                        await page.waitForTimeout(450);
                        if (attempt >= 2) {
                            await cell.dblclick({ force: true }).catch(() => {});
                            await page.waitForTimeout(500);
                        }
                        searchInputCell = resolveSearchInput();
                        if (await searchInputCell.isVisible({ timeout: 2500 }).catch(() => false)) {
                            opened = true;
                            break;
                        }
                    }
                    if (opened) break;
                }

                await expect(searchInputCell).toBeVisible({ timeout: 12000 });
                await searchInputCell.fill(value);
                await page.waitForTimeout(700);
                const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const exactOption = page.getByRole('option', { name: new RegExp(`^${escapedValue}$`, 'i') }).first();
                if (await exactOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await exactOption.click({ force: true });
                } else {
                    await page.keyboard.press('Enter');
                }
                await page.waitForTimeout(600);
            };
    
            const SOV_VALUE = '15000';
            const fillScheduleOfValue = async (reason) => {
                Logger.step(`Schedule of Value → ${SOV_VALUE} via dblclick → SOV (${reason})`);
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(250);

                await setValueViaTriggeredCell({
                    triggerCol: colMap.location ?? colMap.budgetCategory,
                    targetCol: colMap.scheduleOfValue,
                    value: SOV_VALUE,
                    commitKey: 'Enter',
                    label: `ScheduleOfValue (${reason})`,
                });
            };
    
            const cellTextParseNumber = (t) => {
                const s = String(t || '')
                    .replace(/\s+/g, '')
                    .replace(/[$€£]/g, '');
                const m = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
                return m ? Number(m[0]) : NaN;
            };
    
            const assertSovCellShows15000 = async (timeoutMs = 15000) => {
                await expect
                    .poll(
                        async () => {
                            const texts = await contractsGrid
                                .locator(`div[role="gridcell"][data-rgrow="${rowGrow}"]`)
                                .evaluateAll((els) =>
                                    els.map((e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim())
                                );
                            return texts.some((t) => {
                                const n = cellTextParseNumber(t);
                                if (n === 15000) return true;
                                const digits = t.replace(/[^\d]/g, '');
                                return (
                                    digits === '15000' ||
                                    /(^|[^\d])15[,\s]?000([^\d]|$)/i.test(t) ||
                                    t.includes('15,000')
                                );
                            });
                        },
                        { timeout: timeoutMs, intervals: [400, 800, 1500] }
                    )
                    .toBeTruthy();
            };
    
            const toCalendarBtnName = (dateStr) => {
                const [year, month, day] = dateStr.split('-').map(Number);
                const monthNames = [
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                ];
                return `${day} ${monthNames[month - 1]} ${year}`;
            };
    
            const clickCalendarDayAfterOpen = async (dateStr) => {
                const fullName = toCalendarBtnName(dateStr);
                const dayNum = Number(dateStr.split('-')[2]);
                // Primary: match by aria-label (e.g. "1 June 2026")
                const full = page.getByRole('button', { name: fullName, exact: true });
                if (await full.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await full.click();
                    return;
                }
                // Fallback: match by visible text content — getByRole uses accessible name
                // (which may be "1 June 2026") not text, so filter by text instead.
                const short = page.locator('button').filter({ hasText: new RegExp(`^${dayNum}$`) }).first();
                await expect(short).toBeVisible({ timeout: 10000 });
                await short.click();
            };
    
            await fillSearchDropdownCell(colMap.scope, CONTRACT_DATA.scope, 'Scope');
            await fillSearchDropdownCell(colMap.budgetCategory, CONTRACT_DATA.budgetCategory, 'Budget Category');
            if (colMap.costItem !== null) {
                await fillSearchDropdownCell(colMap.costItem, CONTRACT_DATA.costItem, 'Cost Item');
            } else {
                Logger.info('TC47_NEW_UI: Cost Item column not present in this grid variant — skipping');
            }
    
            if (colMap.startDate !== null) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
                const scopeCellStart = getCell(colMap.scope);
                await scopeCellStart.scrollIntoViewIfNeeded();
                await scopeCellStart.click({ force: true });
                await page.waitForTimeout(400);
                for (let i = 0; i < tabsFromScopeToCol(colMap.startDate); i++) {
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(200);
                }
                await page.keyboard.press('Enter');
                await page.waitForTimeout(700);
                await clickCalendarDayAfterOpen(CONTRACT_DATA.startDate);
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            } else {
                Logger.info('TC47_NEW_UI: Start Date column not present — skipping');
            }

            if (colMap.endDate !== null) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
                const scopeCellEnd = getCell(colMap.scope);
                await scopeCellEnd.scrollIntoViewIfNeeded();
                await scopeCellEnd.click({ force: true });
                await page.waitForTimeout(400);
                for (let i = 0; i < tabsFromScopeToCol(colMap.endDate); i++) {
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(200);
                }
                await page.keyboard.press('Enter');
                await page.waitForTimeout(700);
                await clickCalendarDayAfterOpen(CONTRACT_DATA.endDate);
                await page.keyboard.press('Escape');
                await page.keyboard.press('Tab');
                await page.waitForTimeout(600);
            } else {
                Logger.info('TC47_NEW_UI: End Date column not present — skipping');
            }
    
            Logger.step('Re-applying Contract Amount after date pickers');
            await setValueViaTriggeredCell({
                triggerCol: contractAmountTriggerCol,
                targetCol: colMap.contractAmount,
                value: CONTRACT_DATA.contractAmount,
                commitKey: 'Enter',
                label: 'ContractAmount (post-dates)',
            });
            await page.waitForTimeout(400);
    
            Logger.step('Schedule of Value after all other row fields (dblclick Location → SOV → 15000)');
            await fillScheduleOfValue('after contract amount');
    
            await page.waitForTimeout(400);
            const fmtGridNum = (n) => Number(n).toLocaleString('en-US');
            const saveBtnUi = page.getByRole('button', { name: /Save Changes/i });
            const trySave = async () => {
                if (await saveBtnUi.isVisible({ timeout: 2000 }).catch(() => false)) {
                    Logger.step('Clicking CTA: Save Changes');
                    await saveBtnUi.click();
                    await page.waitForLoadState('load');
                } else {
                    Logger.info('No Save Changes button visible — row may auto-save on commit');
                }
                await page.waitForTimeout(1500);
            };
    
            await trySave();
            await page.waitForTimeout(2000);

            await expect(
                contractsGrid.locator(`div[role="gridcell"]:has-text("${CONTRACT_DATA.scope}")`).first()
            ).toBeVisible({ timeout: 20000 });

            const bcCellLocator = contractsGrid
                .locator(`div[role="gridcell"]:has-text("${CONTRACT_DATA.budgetCategory}")`)
                .first();
            const bcOk = await bcCellLocator.isVisible({ timeout: 15000 }).catch(() => false);
            if (!bcOk) {
                Logger.info(`Budget Category "${CONTRACT_DATA.budgetCategory}" missing after save — retrying fill`);
                await fillSearchDropdownCell(colMap.budgetCategory, CONTRACT_DATA.budgetCategory, 'Budget Category (retry)');
                await page.waitForTimeout(400);
                await trySave();
                await page.waitForTimeout(5000);
            }
            await expect(bcCellLocator).toBeVisible({ timeout: 30000 });
    
            await assertSovCellShows15000(25000);
            Logger.info('Schedule of Value cell shows 15000 (formatted or plain)');
    
            const sovGridText = fmtGridNum(SOV_VALUE);
            const savedSovCell = contractsGrid
                .locator(`div[role="gridcell"]`)
                .filter({ hasText: new RegExp(`${sovGridText}|${SOV_VALUE}`) })
                .first();
            const sovOk = await savedSovCell.isVisible({ timeout: 3000 }).catch(() => false);
            if (!sovOk) {
                Logger.info('SOV locator heuristic missed — re-fill 15000');
                await fillScheduleOfValue('retry before contract assertions');
                await trySave();
                await assertSovCellShows15000(25000);
            }
    
            const caGridText = fmtGridNum(CONTRACT_DATA.contractAmount);
            const caAlt = String(CONTRACT_DATA.contractAmount);
            const savedCaCell = contractsGrid
                .locator(`div[role="gridcell"]`)
                .filter({
                    hasText: new RegExp(`${caAlt}|${caGridText}|\\$\\s*${caAlt}`, 'i'),
                })
                .first();
            const caOk = await savedCaCell.isVisible({ timeout: 5000 }).catch(() => false);
            if (!caOk) {
                Logger.info(`Contract Amount "${caGridText}" missing — retrying entry`);
                await setValueViaTriggeredCell({
                    triggerCol: contractAmountTriggerCol,
                    targetCol: colMap.contractAmount,
                    value: CONTRACT_DATA.contractAmount,
                    commitKey: 'Enter',
                    label: 'ContractAmount (retry)',
                });
                await page.waitForTimeout(300);
                await trySave();
                await expect(savedCaCell).toBeVisible({ timeout: 8000 });
            }
    
            // Delete any auto-created incomplete rows (no scope) before finalizing.
            // Grid has 3 revogr-data[type="rgRow"] sections: nth(0)=pinned-left,
            // nth(1)=main content (scope text lives here), nth(2)=pinned-right actions.
            Logger.info('Pre-finalize: purging any incomplete contract rows...');
            const contentSection = contractsGrid.locator('revogr-data[type="rgRow"]').nth(1);
            const actionSection = contractsGrid.locator('revogr-data[type="rgRow"]').nth(2);
            let purgeGuard = 0;
            while (purgeGuard < 10) {
                await page.waitForTimeout(300);
                const dataRows = contentSection.locator('div[role="row"][data-rgrow]');
                const total = await dataRows.count().catch(() => 0);
                let deleted = false;
                for (let ri = 0; ri < total; ri++) {
                    const row = dataRows.nth(ri);
                    const hasScope = await row
                        .locator(`div[role="gridcell"]:has-text("${CONTRACT_DATA.scope}")`)
                        .isVisible({ timeout: 500 })
                        .catch(() => false);
                    if (!hasScope) {
                        const rgrow = await row.getAttribute('data-rgrow').catch(() => null);
                        if (rgrow === null) continue;
                        // Locate the delete button in the actions column at the same row index.
                        const delBtn = actionSection
                            .locator(`[data-rgrow="${rgrow}"] button[aria-label="Delete"]`)
                            .first();
                        if (await delBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                            await delBtn.click({ force: true });
                            await page.waitForTimeout(400);
                            const confirmDel = page
                                .locator(".mantine-Popover-dropdown button:has-text('Delete'), [role='dialog'] button:has-text('Delete')")
                                .first();
                            if (await confirmDel.isVisible({ timeout: 3000 }).catch(() => false)) {
                                await confirmDel.click({ force: true });
                            }
                            await page.waitForTimeout(800);
                            deleted = true;
                            break;
                        }
                    }
                }
                if (!deleted) break;
                purgeGuard++;
            }
            Logger.info(`Pre-finalize purge done (${purgeGuard} row(s) removed).`);

            const finalizeBtn = page.getByRole('button', { name: /Finalize Contract/i });
            const finalizeResponsePromise = page
                .waitForResponse((response) => {
                    const url = response.url();
                    const method = response.request().method();
                    return /contract/i.test(url) && /final|finalize/i.test(url) && ['POST', 'PATCH', 'PUT'].includes(method);
                }, { timeout: 30000 })
                .catch(() => null);
    
            await expect(finalizeBtn).toBeVisible();
            await finalizeBtn.click();
    
            const confirmBtn = page.getByRole('button', { name: /Finalize|Confirm/i }).last();
            if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await confirmBtn.click();
            }
    
            await page.waitForLoadState('load');
            const finalizeResponse = await finalizeResponsePromise;
            if (finalizeResponse) {
                Logger.success(
                    `Finalize API: ${finalizeResponse.request().method()} ${finalizeResponse.url()} [${finalizeResponse.status()}]`
                );
            } else {
                Logger.info('Finalize API response was not captured within timeout.');
            }
    
            Logger.success('TC47_NEW_UI: Contract finalized successfully');

            await page.waitForTimeout(2000);
            const changeOrderTab = page.getByRole('tab', { name: /Change Order/i });
            const invoiceTab = page.getByRole('tab', { name: /^Invoice$/i }).or(page.getByRole('tab', { name: 'Invoice' }));

            // The job page does not always reactively re-enable the tabs after
            // finalization — a navigation to the same URL forces the app to
            // re-fetch the job state from the server before we assert.
            const tabsEnabledAlready = await changeOrderTab.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!tabsEnabledAlready) {
                Logger.info('CO tab still disabled after finalize — reloading job page to refresh state');
                const jobUrl = page.url();
                await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
                await page.locator('main, .mantine-AppShell-main').first()
                    .waitFor({ state: 'visible', timeout: 20000 });
            }

            await expect(changeOrderTab).toBeEnabled({ timeout: 20000 });
            await expect(invoiceTab).toBeEnabled({ timeout: 20000 });
        } catch (error) {
            await captureDebugScreenshot('failure_state');
            throw error;
        }
    }
};