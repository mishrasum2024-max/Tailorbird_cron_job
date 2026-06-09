function simpleApprovalLocators(page) {
    return {
        // Sidebar
        approvalTab: page.locator('text=Approvals').first(),

        // Top tabs
        myApprovalsTab: page.getByRole('tab', { name: 'My Approvals' }),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals' }),

        // Search
        searchInput: page.getByPlaceholder('Search...'),

        // Table
        tableRows: page.locator('[role="row"]'),
        columnHeaders: page.locator('[role="columnheader"]'),

        // Toolbar (My / All Approvals): Table dropdown holds Add custom column + Hide/show columns
        filterButton: page.locator('main').getByRole('button', { name: 'Filter' }),
        exportButton: page.locator('main').getByRole('button', { name: 'Export' }),
        tableMenuButton: page
            .locator('main')
            .getByTestId('bt-table-action')
            .or(page.locator('main').getByRole('button', { name: 'Table' })),
        addColumnMenuItem: page.getByTestId('bt-table-action-add-column'),
        hideShowColumnsMenuItem: page.getByTestId('bt-table-action-hide-show-columns'),

        addColumnNameInput: page.getByPlaceholder(/Enter column name/i),
        addColumnDescInput: page.getByPlaceholder(/Enter column description/i).or(page.getByLabel(/description/i)),
        addColumnSubmitButton: page.getByRole('button', { name: /^Add column$/i }),

        manageColumnsDrawer: page.getByRole('dialog', { name: 'Manage Columns' }),

        // Actions in row
        viewDetailsButton: page.locator('button[title="View Details"]').first(),
    };
}

module.exports = { simpleApprovalLocators };
