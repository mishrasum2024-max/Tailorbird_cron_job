/**
 * Change Order Locators
 * @param {import('@playwright/test').Page} page
 */
function changeOrderLocators(page) {
    return {
        // Change Order Tab and List
        changeOrderTab: page.getByRole('tab', { name: 'Change Orders' }),
        addChangeOrderButton: page.getByRole('button', { name: 'Create Change Order', exact: true }),
        
        // Change Order List Grid
        changeOrderGrid: page.locator('revo-grid:has([role="columnheader"] span:text("Change Order Number"))'),
        changeOrderRows: page.locator('div[role="row"]:has(div[role="gridcell"]:has-text("Change Order #"))'),
        
        // Column Headers
        columnHeader: (name) => page.getByRole('columnheader', { name }),
        changeOrderNumberHeader: page.getByRole('columnheader', { name: 'Change Order Number' }),
        titleHeader: page.getByRole('columnheader', { name: 'Title' }),
        descriptionHeader: page.getByRole('columnheader', { name: 'Description' }),
        statusHeader: page.getByRole('columnheader', { name: 'Status' }),
        amountHeader: page.getByRole('columnheader', { name: 'Amount' }),
        approvedAtHeader: page.getByRole('columnheader', { name: 'Approved At' }),
        changeDateHeader: page.getByRole('columnheader', { name: 'Change Order Date' }),
        attachmentsHeader: page.getByRole('columnheader', { name: 'Attachments' }),
        
        // Grid Cells
        titleCellByName: (name) => page.getByRole('gridcell', { name }),
        draftStatusCells: page.getByRole('gridcell', { name: 'Draft' }),
        approvedStatusCells: page.getByRole('gridcell', { name: 'Approved' }),
        
        // Change Order Form/Dialog Fields
        overviewSection: page.locator('text=Overview'),
        changeOrderNumberInput: page.getByRole('textbox', { name: 'Enter change order number' }),
        titleInput: page.getByRole('textbox', { name: 'Enter title' }),
        descriptionInput: page.getByRole('textbox', { name: 'Enter description' }),
        changeOrderDateLabel: page.locator('text=Change Order Date:'),
        documentsLabel: page.locator('text=Documents:'),
        
        // Change Order Date Button
        changeOrderDateButton: page.getByRole('button', { name: /\d{1,2}\/\d{1,2}\/\d{4}/ }),
        
        // Navigation Buttons
        goBackButton: page.getByRole('button', { name: 'Go Back' }),
        saveButton: page.getByRole('button', { name: /save|confirm|submit/i }).first(),
        
        // Modal/Dialog
        modal: page.locator('dialog, [role="dialog"], .mantine-Modal-root').first(),
        
        // File Upload
        fileUploadInput: page.locator('input[type="file"]'),
        
        // Export Button
        exportButton: page.locator('button:has(svg.lucide-download)').first(),
        
        // Amount Grid Cell Locators
        amountCellWithDollar: page.locator('div[role="gridcell"]').filter({ has: page.locator('span:text("$")') }).first(),
        amountCellByColumn: (colIndex) => page.locator(`div[role="gridcell"][data-rgcol="${colIndex}"]`).first(),
        amountCellWithZero: page.locator('div[role="gridcell"]:has-text("$0")').first(),
        gridCellInput: page.locator('input:focus, input[data-testid="bird-table-currency-input"], input[data-testid="bird-table-number-input"]').first(),
        allGridCells: page.locator('div[role="gridcell"]'),

        // Change Order Details - snapshot values (in dialog or details view)
        changeOrderDetailsScope: page.locator('dialog,[role="dialog"], [data-testid*="change-order"]').filter({ hasText: /Change Order|Overview/i }).first(),
        currentContractValueLabel: page.locator('text=Current Contract Value').or(page.locator('text=Current Contract')).first(),
        revisedContractAmountLabel: page.locator('text=Revised Contract Amount').first(),
        changeOrderAmountHeader: page.locator('[role="columnheader"]').filter({ hasText: 'Change Order Amount' }).first()
    };
}

module.exports = { changeOrderLocators };
