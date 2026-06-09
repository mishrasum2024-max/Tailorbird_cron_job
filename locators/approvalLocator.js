function approvalJobLocators(page) {
    return {
        // Left sidebar Approvals link - first occurrence of text Approvals
        approvalTab: page.locator('text=Approvals').first(),
        
        // Top tabs
        approvalTemplatesTab: page.getByRole('tab', { name: 'Approval Templates' }),
        myApprovalsTab: page.getByRole('tab', { name: 'My Approvals' }),
        allApprovalsTab: page.getByRole('tab', { name: 'All Approvals' }),
        
        // Search input
        searchInput: page.getByPlaceholder('Search...'),
        
        // Toolbar: Filter, Views, Table (dropdown: add column / hide-show), Export
        filterButton: page.locator('main').getByRole('button', { name: 'Filter' }),
        createViewButton: page.locator('main').getByRole('button', { name: /^Views?$/i }),
        tableMenuButton: page
            .locator('main')
            .getByTestId('bt-table-action')
            .or(page.locator('main').getByRole('button', { name: 'Table' })),
        addColumnMenuItem: page.getByTestId('bt-table-action-add-column'),
        hideShowColumnsMenuItem: page.getByTestId('bt-table-action-hide-show-columns'),
        exportButton: page.locator('main').getByRole('button', { name: 'Export' }),
        
        // Create Template button
        // createTemplateButton: page.getByRole('button', { name: 'Create Template' }),
        createTemplateButton: page.getByRole('button', { name: 'Create Template' }).first(),
        
        // Form inputs on Create/Edit Template dialog
        templateNameInput: page.getByPlaceholder('Enter template name'),
        changeOrderRadio: page.getByRole('radio', { name: 'Change Order' }),
        invoiceRadio: page.getByRole('radio', { name: 'Invoice' }),
        contractRadio: page.getByRole('radio', { name: 'Contract/PO' }),
        budgetRadio: page.getByRole('radio', { name: 'Budget' }),

         addPropertiesTrigger: page
            .getByRole('button', { name: /Search and add properties/i })
            .or(page.locator('button').filter({ hasText: 'Search and add properties' })),
       
        
        addPropertiesInput: page.getByPlaceholder('Search properties'),
        selectApproverInput: page.getByPlaceholder('Select approver'),
        amountInput: page.getByPlaceholder('Enter Amount'),
        // Create/Edit template drawer (Mantine Drawer uses role="dialog")
        templateDialog: page
            .getByRole('dialog')
            .filter({ has: page.getByPlaceholder('Enter template name') }),
        // "Always Required" checkbox inputs — one per approver row; keep scoped to templateDialog (property picker is portaled).
        alwaysRequiredCheckboxesInTemplateDialog: page
            .getByRole('dialog')
            .filter({ has: page.getByPlaceholder('Enter template name') })
            .locator('input[type="checkbox"]'),

        // Dialog buttons
        cancelButton: page.getByRole('button', { name: 'Cancel' }),
        goBackButton: page.getByRole('button', { name: 'Go Back' }),
        createTemplateSubmit: page.getByRole('button', { name: /^Create Template$/ }).last(),
        updateTemplateButton: page.getByRole('button', { name: 'Update Template' }),
        
        // Table
        templateTable: page.locator('treegrid'),
        tableHeaders: page.locator('columnheader'),
        tableRows: page.getByRole('row'),
        
        // Action buttons in table
        editButtons: page.getByRole('button', { name: 'Edit' }),
        
        // Delete confirmation dialog buttons
        deleteConfirmButton: page.getByRole('button', { name: 'Delete' }).last(),
        deleteConfirmCancelButton: page.getByRole('button', { name: 'Cancel' }).last(),
        
        // Filter dialog
        filterSearchInput: page.getByPlaceholder('Enter values to search for (OR logic)').first(),
        
        // Manage Columns (drawer/modal)
        manageColumnsDialog: page
            .getByRole('dialog', { name: 'Manage Columns' })
            .or(page.locator('section[role="dialog"]').filter({ hasText: 'Manage Columns' })),
        defaultColumnsButton: page.locator('button').filter({ hasText: 'Default Columns' }).first(),
        columnCheckbox: page.locator('checkbox').first(),
        
        // Create View
        viewNameInput: page.getByPlaceholder('Enter view name...'),
        saveViewButton: page.getByRole('button').filter({ hasText: /save/i }).first(),
        
        // Template search cells
        templateNameCell: (name) => page.locator(`text=${name}`).first(),
        columnHeaderByName: (header) => page.locator(`columnheader:has-text("${header}")`),
        
        // Dialog
        dialog: page.locator('dialog'),
        goBackDialog: page.locator('dialog').filter({ hasText: 'Go Back' }),
        
        // Properties (for property creation in approval tests)
        propertiesNavLink: page.locator(".mantine-NavLink-root:has-text('Properties')").first(),
        createPropertyButton: page.locator("button:has-text('Create Property')"),
        addPropertyModalHeader: page.locator(".mantine-Modal-header:has-text('Add property')"),
        propertyNameInput: page.getByLabel('Name'),
        propertyAddressInput: page.getByRole('textbox', { name: 'Address' }),
        addressSuggestion: (address) => page.locator(`.mantine-Autocomplete-option:has-text("${address}")`),
        propertyTypeInput: page.locator('input[placeholder="Select type"]'),
        propertyTypeOption: (type) => page.locator(`.mantine-Select-option:has-text("${type}")`),
        addPropertyButton: page.getByRole('button', { name: /add property/i }),
        propertyBreadcrumb: (name) => page.locator(`.mantine-Breadcrumbs-root:has-text('${name}')`),
        propertyGrid: (name) => page.locator(`.mantine-SimpleGrid-root p:has-text('${name}')`),
    }
};

module.exports = { approvalJobLocators };
