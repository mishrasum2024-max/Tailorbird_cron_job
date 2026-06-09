function budgetLocators(page) {
    return {
        // --- Navigation sidebar ---
        budgetTab: page.locator('nav').getByRole('link', { name: 'Budget' }).first(),
        budgetNavSection: page.locator('nav a.mantine-NavLink-root').filter({ hasText: 'Budget' }).first(),
        budgetCategoryNav: page.locator('nav').locator('a.mantine-NavLink-root, [role="menuitem"]').filter({ hasText: 'Budget Category' }).first(),
        budgetNavText: page.locator('nav').locator('text=Budget').first(),
        categoryNavText: page.locator('nav').locator('text=Category').first(),

        // --- Property selection ---
        propertyDropdownButton: page
            .getByRole('button', { name: /Select a Property|Test Property|Sample Property|name_/i })
            .first(),
        brookProperty: page.getByRole('menuitem', { name: /Test Property 2_The Westerham/i }),
        propertyHeader: page.getByRole('button', { name: /Test Property 2_The Westerham/i }),
        propertyMenuItems: page.getByRole('menuitem'),

        // --- Year & Version selectors ---
        yearText: page.locator('text=2026').first(),
        versionText: page.locator('text=Version').first(),
        versionDropdown: page.getByRole('textbox').nth(1),
        draftOption: page.getByRole('option', { name: /draft/i }),
        manageVersionsOption: page.getByRole('option', { name: 'Manage Versions' }),
        manageVersionsDialog: page.getByRole('dialog', { name: 'Manage budget versions' }),

        // --- Grid / Table ---
        columnHeader: (name) => page.locator(`[role="columnheader"]:has-text("${name}")`),
        categoryCodeColumn: page.locator('[col-id="category_code"], [role="columnheader"]:has-text("Category Code")'),
        tableRows: page.locator('[role="row"]'),
        dataRows: page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }),
        gridCells: page.locator('[role="gridcell"]'),
        treegrid: page.locator('[role="treegrid"]'),
        treegridDataRows: page.locator('[role="treegrid"] [role="row"][data-rgrow]'),
        firstRowCategoryCell: page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }).first().locator('[role="gridcell"]').nth(2),

        // --- Budget items (for assertion) ---
        budgetItemText: (name) => page.locator(`text=${name}`).first(),

        // --- Overview panel & toolbar ---
        overviewPanel: page.getByRole('tabpanel', { name: 'Overview' }),
        searchBox: page.getByRole('textbox', { name: 'Search...' }),
        reviseBudgetsBtn: page.getByRole('button', {
            name: /Revise Budgets|Create First Budget/i,
        }),
        createBudgetRevisionBtn: page
            .getByRole('button', { name: /Create budget revision|Create a budget revision/i })
            .or(
                page
                    .locator('button')
                    .filter({ hasText: /Create budget revision|Create a budget revision/i })
            ),

        // --- Add row ---
        addRowMenu: page.getByTestId('bt-add-row-menu'),
        addRowBtn: page.getByTestId('bt-add-row'),
        addRowMenuItem: page.getByRole('menuitem', { name: /Add row|Add/i }),
        addBudgetBtn: page.getByRole('button', { name: /Add Budget|Add.*Budget|Add row|Add Row/i }),

        // --- View management (toolbar: first control in the Table/Export group is always Views) ---
        viewMenuBtn: page
            .getByRole('tabpanel', { name: 'Overview' })
            .locator('.mantine-Group-root')
            .filter({ has: page.getByTestId('bt-table-action') })
            .getByRole('button')
            .first(),
        viewNameInput: page.getByRole('textbox', { name: 'Enter view name...' }).or(page.getByPlaceholder(/Enter view name/i)),
        createNewViewMenuItem: page.getByRole('menuitem', { name: 'Create New View' }),
        defaultViewOption: page.locator('[role="menuitem"], [role="option"]').filter({ hasText: /Switch to Default|^Default$/i }),

        // --- Table menu (Add custom column + Hide/show columns live under Table dropdown) ---
        tableMenuBtn: page.getByRole('tabpanel', { name: 'Overview' }).getByTestId('bt-table-action'),
        addColumnMenuItem: page.getByTestId('bt-table-action-add-column'),
        hideShowColumnsMenuItem: page.getByTestId('bt-table-action-hide-show-columns'),

        // --- Column management ---
        columnNameInput: page.getByRole('textbox', { name: /Enter column name/ }),
        columnDescInput: page.getByRole('textbox', { name: /Enter column description/ }),
        addColumnSubmitBtn: page.getByRole('button', { name: 'Add column' }),
        manageColumnsDialog: page.getByRole('dialog', { name: 'Manage Columns' }),

        // --- Export ---
        exportBtn: page.getByRole('tabpanel', { name: 'Overview' }).getByRole('button', { name: 'Export' }),

        // --- Category cells (for assertion) ---
        categoryDropdown: page.locator('[role="combobox"], .ag-cell-edit-input, [col-id="category_code"] input'),
        categoryOption: (text) => page.getByRole('option', { name: text }).or(page.locator(`[role="menuitem"]:has-text("${text}")`)),
        categoryCells: page.locator('[role="gridcell"]').filter({ hasText: /Construction|Electrical|Plumbing|HVAC|Finishes|Landscaping|Roofing|Carpentry|Fire Protection|Security/i }),
        categoryColumnHeader: page.locator('[role="columnheader"]:has-text("Category")'),

        // --- Revise Budget editor ---
        revisionDialog: page.getByRole('dialog'),
        budgetTabInRevision: page.getByRole('tab', { name: 'Budget' }),
        submitForApprovalBtn: page.getByRole('dialog').getByRole('button', { name: /Submit for Approval|Submit for Review/i }).first()
            .or(page.getByRole('button', { name: /Submit for Approval|Submit for Review/i }).first()),

        // --- Revise Budget toolbar ---
        resetTableOption: page.getByRole('button', { name: /Reset|Reset Table/i }),
        uploadBudgetFileInput: page.locator('input[type="file"]'),

        // --- File upload flow ---
        uploadGuideModal: page.getByRole('dialog', { name: /Budget File Upload Guide|Upload Guide/i }),
        uploadGuideContinueBtn: page.getByRole('button', { name: /Continue/i }),
        fromDeviceBtn: page.getByRole('button', { name: /From device|Choose file|Browse|Select file/i }),
        uploadModal: page.locator('[role="dialog"]').filter({ hasText: /Upload|Import|file|mapping|columns/i }),
        doneBtn: page.getByRole('button', { name: /Done|Apply|Confirm|Import/i }),

        // --- Confirmation dialogs ---
        deleteBtn: page.getByRole('button', { name: 'Delete' }),
        confirmBtn: page.getByRole('button', { name: /Submit|Confirm|Yes|Approve/i }),
        resetConfirmBtn: page.getByRole('button', { name: /Reset|Confirm|Yes/i }),
        deleteDraftDialog: page.getByRole('dialog').filter({ hasText: /Delete.*Draft|Delete Budget Version/i }),
    };
}

module.exports = { budgetLocators };
