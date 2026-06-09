/**
 * Vendors Directory & Vendor Detail page locators
 * URL: vendors/directory, vendors/{id}
 */
function vendorLocators(page) {
    return {
        // --- Navigation ---
        vendorsNav: page.locator('nav').locator('a, [role="menuitem"]').filter({ hasText: 'Vendors' }).first(),
        directoryLink: page.locator('nav').locator('a, [role="menuitem"]').filter({ hasText: 'Directory' }).first(),
        moreMenuLink: page.locator('nav').filter({ hasText: 'More' }).first(),

        // --- Directory page ---
        inviteNewVendorBtn: page.getByRole('button', { name: 'Invite New Vendor' }),
        searchInput: page.getByRole('textbox', { name: 'Search...' }),
        filterBtn: page.locator('button:has(svg.lucide-funnel)').first(),
        exportBtn: page.locator('button:has(svg.lucide-download)').first(),
        viewDropdownBtn: page.locator('main').getByRole('button').first().or(page.getByRole('tabpanel', { name: 'Overview' }).getByRole('button').first()),
        addColumnBtn: page.getByTestId('bt-add-column').first().or(page.locator('main').locator('[data-testid="bt-add-column"]').first()),
        manageColumnsBtn: page.locator('button:has(svg.lucide-settings)').first(),

        // --- Filters panel ---
        filtersPanel: page.locator('.mantine-Paper-root').filter({ hasText: 'Filters' }),
        filterInput: page.getByPlaceholder('Enter values to search for (OR logic)'),
        tradeCheckbox: (name) => page.getByRole('checkbox', { name }),

        // --- Grid ---
        grid: page.locator('[role="treegrid"], [role="grid"]').first(),
        columnHeader: (name) => page.locator(`[role="columnheader"]:has-text("${name}")`),
        dataRows: page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }),
        viewDetailsBtns: page.getByRole('button', { name: 'View Details' }),

        // --- View / Column management ---
        viewNameInput: page.getByPlaceholder(/Enter view name/i),
        createNewViewItem: page.getByRole('menuitem', { name: 'Create New View' }),
        defaultViewOption: page.locator('[role="menuitem"], [role="option"]').filter({ hasText: /Default/i }).first(),
        manageColumnsDialog: page.getByRole('dialog', { name: 'Manage Columns' }).or(page.locator('section[role="dialog"]').filter({ hasText: 'Manage Columns' })),
        columnNameInput: page.getByRole('textbox', { name: /column name/i }).or(page.getByPlaceholder(/Enter column name/i)),
        columnDescInput: page.getByPlaceholder(/description/i),
        addColumnSubmitBtn: page.getByRole('button', { name: 'Add column' }),

        // --- Vendor Detail page ---
        overviewTab: page.getByRole('tab', { name: 'Overview' }),
        activityTab: page.getByRole('tab', { name: 'Activity' }),
        editBtn: page.getByRole('button', { name: 'Edit' }),
        breadcrumbManageVendors: page.getByRole('link', { name: 'Manage Vendors' }),
        breadcrumbDirectory: page.locator('.mantine-Breadcrumbs-root').filter({ hasText: 'Directory' }),

        // --- Overview fields ---
        vendorIdLabel: page.locator('text=Vendor ID').first(),
        companyNameLabel: page.locator('text=Company Name').first(),
        usersTable: page.locator('[role="table"], [role="grid"]').filter({ has: page.locator('text=Users') }).first(),

        // --- Activity tab ---
        bidsSubmittedLabel: page.locator('text=Bids Submitted').first(),
        contractsAwardedLabel: page.locator('text=Contracts Awarded').first(),
        invoicesProcessedLabel: page.locator('text=Invoices Processed').first(),
        changeOrdersLabel: page.locator('text=Change Orders').first(),

        // --- Invite New Vendor ---
        inviteDialog: page.getByRole('dialog').filter({ hasText: /Invite|New Vendor|Organization/i }),
        inviteForm: page.locator('form, section[role="dialog"]').filter({ hasText: /Organization|Vendor/i }),
        companyNameInput: page.getByRole('dialog').getByLabel(/Company Name/i),
        firstNameInput: page.getByRole('dialog').getByLabel(/First Name/i),
        lastNameInput: page.getByRole('dialog').getByLabel(/Last Name/i),
        phoneInput: page.getByRole('dialog').getByLabel(/Phone Number/i),
        emailInput: page.getByRole('dialog').getByLabel(/Email Address/i),
        addressSearch: page.getByRole('dialog').getByPlaceholder(/Search and select location/i),
        tradeSearch: page.getByRole('dialog').getByPlaceholder(/Select trade/i),
        serviceAreaSearch: page.getByRole('dialog').getByPlaceholder(/Search and select cities or regions/i),
        createVendorBtn: page.getByRole('dialog').getByRole('button', { name: 'Create Vendor' }),

        // --- Edit vendor form ---
        editDialog: page.getByRole('dialog'),
        saveBtn: page.getByRole('button', { name: /Save|Update/i }),

        // --- Error indicators (exclude grid cells - data may contain 'error' in strings like onerror=) ---
        errorAlertLocator: page.locator('.mantine-Alert-root[color="red"]'),
        errorInMain: page.locator('main').getByText(/^Error:|404|Not found|Something went wrong/i),
    };
}

module.exports = { vendorLocators };
