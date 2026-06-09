const { expect } = require('@playwright/test');
const { simpleApprovalLocators } = require('../locators/simpleApprovalLocator');
const { Logger } = require('../utils/logger');

class SimpleApprovalPage {
    constructor(page) {
        this.page = page;
        this.loc = simpleApprovalLocators(page);
    }

    async navigateToApprovalTab() {
        await this.loc.approvalTab.click();
        await this.page.waitForTimeout(20000);
        await this.page.waitForTimeout(1000);
    }

    async waitForPageLoad() {
        await this.page.waitForTimeout(20000);
        await this.page.waitForTimeout(1500);
    }

    async navigateToMyApprovalsTab() {
        await this.loc.myApprovalsTab.click();
        await this.page.waitForURL('**/approvals/my-approvals**', { timeout: 15000 }).catch(() => {});
        await expect(this.loc.myApprovalsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
        await this.waitForPageLoad();
    }

    async navigateToAllApprovalsTab() {
        await this.loc.allApprovalsTab.click();
        await this.page.waitForURL('**/approvals/all-approvals**', { timeout: 15000 }).catch(() => {});
        await expect(this.loc.allApprovalsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
        await this.waitForPageLoad();
    }

    async searchApprovals(term) {
        await this.loc.searchInput.fill(term);
        await this.page.waitForTimeout(600);
    }

    async clearSearch() {
        await this.loc.searchInput.clear();
        await this.page.waitForTimeout(400);
    }

    async getTableRowCount() {
        const count = await this.loc.tableRows.count();
        return Math.max(0, count - 1);
    }

    async getAllTableHeaders() {
        // Wait for the Property Name header to ensure full table is loaded
        const propertyHeader = this.page.locator('[role="columnheader"]', { hasText: 'Property Name' });
        try {
            await propertyHeader.waitFor({ state: 'visible', timeout: 15000 });
        } catch {
            // Fallback: wait for any column header to appear before giving up
            const anyHeader = this.page.locator('[role="columnheader"]').first();
            await anyHeader.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
            await this.page.waitForTimeout(5000);
        }
        return await this.loc.columnHeaders.allTextContents();
    }

    async viewApprovalDetails(rowIndex = 0) {
        const viewBtn = this.page.locator('[role="treegrid"] button[title="View Details"]').first();
        try {
            await viewBtn.waitFor({ state: 'visible', timeout: 10000 });
            await viewBtn.click();
            await this.page.waitForTimeout(1000);
            return true;
        } catch {
            return false;
        }
    }

    async isApprovalModalVisible() {
        try {
            const dialog = this.page.getByRole('dialog', { name: 'Approval Details' });
            await dialog.waitFor({ state: 'visible', timeout: 5000 });
            return await dialog.isVisible();
        } catch {
            return false;
        }
    }

    async closeApprovalModal() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
        return true;
    }

    async clickFilterButton() {
        await this.loc.filterButton.click();
        await this.page.waitForTimeout(600);
        return true;
    }

    async clickSettingsButton() {
        await this.loc.tableMenuButton.click();
        await expect(this.loc.hideShowColumnsMenuItem).toBeVisible({ timeout: 10000 });
        await this.loc.hideShowColumnsMenuItem.click();
        await expect(this.loc.manageColumnsDrawer).toBeVisible({ timeout: 10000 });
        return true;
    }

    async clickExportButton() {
        await this.loc.exportButton.click();
        await this.page.waitForTimeout(800);
        return true;
    }

    async addColumndata() {
        const colName = `ApprCol_${Date.now()}`;
        await this.loc.tableMenuButton.click();
        await expect(this.loc.addColumnMenuItem).toBeVisible({ timeout: 10000 });
        await this.loc.addColumnMenuItem.click();
        await this.page.waitForTimeout(400);

        const nameInput = this.loc.addColumnNameInput.first();
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill(colName);
        const desc = this.loc.addColumnDescInput.first();
        if (await desc.isVisible().catch(() => false)) {
            await desc.fill('Automation custom column');
        }
        await this.loc.addColumnSubmitButton.click();
        await this.page.waitForTimeout(1000);
        return true;
    }

    async closeDialog() {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(400);
        return true;
    }
}

module.exports = { SimpleApprovalPage };
