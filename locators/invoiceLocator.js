/**
 * Invoice Locators
 * @param {import('@playwright/test').Page} page
 */
function invoiceLocators(page) {
    return {
        mainContainer: page.locator('main').first(),

        // Invoice Tab and List
        invoiceTab: page.getByRole('tab', { name: 'Invoice' }),
        addInvoiceButton: page.getByRole('button', { name: 'Create Invoice', exact: true }),
        
        // Invoice List Grid
        invoiceGrid: page.locator('revo-grid:has([role="columnheader"] span:text("Invoice Number"))'),
        invoiceRows: page.locator('div[role="row"]:has(div[role="gridcell"]:has-text("Invoice #"))'),
        
        // Column Headers - Invoice List
        columnHeader: (name) => page.getByRole('columnheader', { name }),
        invoiceNumberHeader: page.getByRole('columnheader', { name: 'Invoice Number' }),
        titleHeader: page.getByRole('columnheader', { name: 'Title' }),
        descriptionHeader: page.getByRole('columnheader', { name: 'Description' }),
        statusHeader: page.getByRole('columnheader', { name: 'Status' }),
        amountHeader: page.getByRole('columnheader', { name: 'Amount' }),
        
        // Invoice Details Grid Column Headers
        scopeHeader: page.getByRole('columnheader', { name: 'Scope' }),
        categoryHeader: page.getByRole('columnheader', { name: 'Category' }),
        locationHeader: page.getByRole('columnheader', { name: 'Location' }),
        scheduleOfValueHeader: page.getByRole('columnheader', { name: 'Schedule of Value' }),
        costItemHeader: page.getByRole('columnheader', { name: 'Cost Item' }),
        invoiceAmountHeader: page.getByRole('columnheader', { name: 'Invoice Amount' }),
        lastInvoiceAmountHeader: page.getByRole('columnheader', { name: 'Last Invoice Amount' }),
        totalInvoicedToDateHeader: page.getByRole('columnheader', { name: 'Total Invoiced To Date' }),
        poNumberHeader: page.getByRole('columnheader', { name: 'PO Number' }),
        contractValueHeader: page.getByRole('columnheader', { name: 'Contract Value' }),
        
        // Grid Cells
        titleCellByName: (name) => page.getByRole('gridcell', { name }),
        draftStatusCells: page.getByRole('gridcell', { name: 'Draft' }),
        pendingStatusCells: page.getByRole('gridcell', { name: 'Pending' }),
        approvedStatusCells: page.getByRole('gridcell', { name: 'Approved' }),
        
        // Invoice Form/Dialog Fields
        overviewSection: page.locator('text=Overview'),
        invoiceNumberInput: page.getByRole('textbox', { name: 'Enter invoice number' }),
        titleInput: page.getByRole('textbox', { name: 'Enter title' }),
        descriptionInput: page.getByRole('textbox', { name: 'Enter description' }),
        
        // Invoice Stats
        currentContractStat: page.locator('text=Current Contract').locator('..').locator('p').first(),
        approvedInvoicesStat: page.locator('text=Approved Invoices').locator('..').locator('p').first(),
        contractRemainingStat: page.locator('text=Contract Remaining').locator('..').locator('p').first(),
        pendingInvoicesStat: page.locator('text=Pending Invoices').locator('..').locator('p').first(),
        
        // Navigation Buttons
        goBackButton: page.getByRole('button', { name: 'Go Back' }),
        confirmInvoiceButton: page.getByRole('button', { name: 'Confirm Invoice' }),
        saveButton: page.getByRole('button', { name: /save|confirm|submit/i }).first(),
        cancelButton: page.getByRole('button', { name: 'Cancel' }),
        
        // Modal/Dialog
        modal: page.locator('dialog, [role="dialog"], .mantine-Modal-root').first(),
        
        // File Upload Section
        fileUploadInput: page.locator('input[type="file"]'),
        fromDeviceButton: page.getByRole('button', { name: 'From device' }),
        googleDriveButton: page.getByRole('button', { name: 'Google Drive' }),
        dropboxButton: page.getByRole('button', { name: 'Dropbox' }),
        documentsLabel: page.locator('text=Invoice Documents'),
        
        // Export Button
        exportButton: page.locator('button:has(svg.lucide-download)').first(),
        
        // Budget Category in Invoice Details Grid
        budgetCategoryHeader: page.getByRole('columnheader', { name: 'Budget Category' }),
        budgetCategoryCells: page.locator('[role="gridcell"][data-rgcol]').filter({ hasText: /^-$|Construction|Electrical|Plumbing|HVAC|Finishes|Landscaping|Roofing|Carpentry/ }),
        budgetCategorySearchInput: page.getByPlaceholder('Search or type to create...'),
        budgetCategoryListbox: page.getByRole('listbox'),
        budgetCategoryOption: (text) => page.getByRole('option', { name: new RegExp(text, 'i') }),
        budgetCategoryFirstOption: page.getByRole('option').first(),

        // Invoice Amount Grid Cell Locators
        invoiceAmountCellWithDollar: page.locator('div[role="gridcell"]').filter({ has: page.locator('span:text("$")') }).first(),
        invoiceAmountCellByColumn: (colIndex) => page.locator(`div[role="gridcell"][data-rgcol="${colIndex}"]`).first(),
        invoiceAmountCellWithZero: page.locator('div[role="gridcell"]:has-text("$0")').first(),
        gridCellInput: page.locator('input:focus, input[data-testid="bird-table-currency-input"], input[data-testid="bird-table-number-input"]').first(),
        allGridCells: page.locator('div[role="gridcell"]'),
        
        // Success/Error Messages
        successMessage: page.locator('[class*="success"], [role="alert"]:has-text("success")'),
        invoiceAddedSuccessMessage: page.locator('text=Invoice Added').or(page.locator('text=Invoice added successfully')),
        
        // Search and Filter (BirdTable list search — must use :visible to avoid matching hidden
        // inputs from inactive sibling tabs; same pattern used in TC09 coWorkspaceListSearch)
        searchInput: page.getByRole('textbox', { name: 'Search...' }),
        listSearchInput: page.locator('main input[placeholder="Search..."]:visible').first(),
        filterButtons: page.locator('button:has(svg.lucide-filter)')
    };
}

module.exports = { invoiceLocators };
