function projectJobLocators(page) {
    return {
        jobsTab: page.getByText('Jobs', { exact: true }),
        jobsTabPanel: page.getByRole('tabpanel', { name: 'Jobs' }),

        addJobMenu: page.getByRole('tabpanel', { name: 'Jobs' }).getByTestId('bt-add-row-menu'),
        addJobMenuItem: (name) => page.getByRole('menuitem', { name }),
        // Jobs table (project or global): Actions uses lucide-eye; optional a11y name "View Details" on some builds.
        viewDetailsButton: page
            .locator('[role="treegrid"], revo-grid')
            .filter({ has: page.getByRole('columnheader', { name: 'Title', exact: true }) })
            .locator('button:has(svg.lucide-eye)')
            .last(),
        deleteButton: page.locator('button[aria-label="Delete Row"]').first(),
        addVendorsButton: page.getByRole('tabpanel', { name: 'Bids' }).locator('div:has(p:has-text("Manage Vendors"))').locator('button:has-text("Add Vendors")'),
        inviteNewVendorButton: page.getByRole('button', { name: /Invite a New Vendor to Bid/i }),
        inviteVendorsToBidButton: page.locator("button:has-text('Invite Vendors To Bid')"),
        manageVendorsToggle: page.getByRole('tabpanel', { name: 'Bids' }).locator('div:has(p:has-text("Manage Vendors")) button').first(),

        titleCell: page.locator(`div[role="gridcell"][col-id="title"]:has-text('—')`).first(),
        inputBox: page.locator('div[role="gridcell"][col-id="title"] input').first(),

        jobType: page.locator('div[col-id="job_type"] span:has-text("Unit Interior")'),
        unitInteriorSpan: page.locator('span:has-text("UNIT INTERIOR")'),
        jobTypeDropdownOption: (typeText) =>
            page.locator(`[data-testid="bird-table-select-dropdown"] p:has-text("${typeText}")`),

        jobSummaryTab: page.locator('.mantine-Tabs-tabLabel:has-text("Job Summary")'),
        descriptionInput: page.locator('input[placeholder="Enter job description"]'),

        selectStartDateBtn: page.getByRole('button', { name: 'Select start date' }),
        selectEndDateBtn: page.getByRole('button', { name: 'Select end date' }),
        dateButtonByAriaLabel: (ariaLabel) => page.locator(`button[aria-label="${ariaLabel}"]`),

        bidsTab: page.getByRole('tab', { name: 'Bids' }),
        bidsTabPanel: page.getByRole('tabpanel', { name: 'Bids' }),
        addRowMenu: page.getByRole('tabpanel', { name: 'Bids' }).getByTestId('bt-add-row-menu'),
        addRowBtn: page.getByRole('tabpanel', { name: 'Bids' }).getByTestId('bt-add-row').first(),
        bidSearchInput: page.locator('input[data-testid="bird-table-text-input"]'),
        bidSearchInput1: page.locator('[role="menu"] input[placeholder="Search or create..."]'),
        bidSearchSuggestion: page.locator(
            '[role="menu"] >> text=Bid with material'
        ),



        firstGridCell: page.locator('div[role="gridcell"]').first(),
        bidsGridFirstScopeCell: page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="treegrid"] [role="row"], revo-grid [role="row"]').first().locator('[role="gridcell"]').first(),
        // First data row scope cell (excludes header) - for updating existing bid
        firstBidRowScopeCell: page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="treegrid"] [role="row"], revo-grid [role="row"]').filter({ has: page.locator('[role="gridcell"]') }).first().locator('[role="gridcell"]').first(),
        bidsGridRowByScope: (scopeText) =>
            page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="treegrid"] [role="row"], revo-grid [role="row"]').filter({ has: page.locator(`[role="gridcell"]:has-text("${scopeText.replace(/"/g, '\\"')}")`) }).first(),
        // Row that has scope and at least 6 gridcells (Quantity=4, Price=5) - use when grid has one row with all columns
        bidsGridDataRowByScope: (scopeText) =>
            page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="treegrid"] [role="row"], revo-grid [role="row"]').filter({ has: page.locator(`[role="gridcell"]:has-text("${scopeText.replace(/"/g, '\\"')}")`) }).filter({ has: page.locator('[role="gridcell"]:nth-child(6)') }).first(),
        // Search input in scope cell (inline editor)
        scopeSearchInput: page.getByRole('tabpanel', { name: 'Bids' }).getByRole('textbox', { name: /Search or type to create/i }),
        // Listbox option to select scope (must click, not Enter). Matches exact or "Create '...'" for new scope.
        scopeListboxOption: (scopeText) =>
            page.getByRole('listbox').locator('[role="option"]').filter({ hasText: scopeText }).first(),
        lastGridCell: page.locator('div[role="gridcell"]').last(),
        firstRowScopeCell: page.locator('div[row-id]').first().locator('div[col-id="scope"]'),

        inviteVendorsFallback: page.locator("//div[@class='m_8bffd616 mantine-Flex-root __m__-_r_af_']//span[@class='m_8d3afb97 mantine-ActionIcon-icon']"),

        templateMenuButton: page.getByRole('tabpanel', { name: 'Bids' }).locator('div:has(p:has-text("Bid Book")) button').first(),
        templateMenuDropdown: page.locator('[role="menu"], [data-menu-dropdown="true"]'),
        templateMenuFirstOption: page.locator('[data-menu-dropdown="true"]').locator('button:has-text("Tailorbird Baseline Bid Book - Detailed")').first(),
        templateMenuSecondOption: page.locator('[data-menu-dropdown="true"]').locator('button:has-text("Save as Template")').first(),
        templateMenuGlobeIcon: page.locator('[data-menu-dropdown="true"]').locator('svg.lucide-globe').first(),
        templateMenuFirstDivider: page.locator('[data-menu-dropdown="true"]').locator('.mantine-Menu-divider').nth(0),

        applyTemplateDialog: page.locator('[data-modal-content="true"]'),
        applyTemplateTitle: page.locator('[data-modal-content="true"]').locator('h2'),
        applyTemplateMessage: page.locator('[data-modal-content="true"]').locator('p'),
        applyTemplateCancelBtn: page.locator('[data-modal-content="true"]').locator('button:has-text("Cancel")'),
        applyTemplateApplyBtn: page.locator('[data-modal-content="true"]').locator('button:has-text("Apply Template")'),

        saveTemplateDialog: page.locator('[data-modal-content="true"]'),
        saveTemplateHeader: page.locator('[data-modal-content="true"]').locator('h2'),
        saveTemplateNameLabel: page.locator('[data-modal-content="true"]').locator('label:has-text("Template Name")'),
        saveTemplateNameInput: page.locator('[data-modal-content="true"]').locator('input[placeholder="Enter template name"]'),
        saveTemplateDescLabel: page.locator('[data-modal-content="true"]').locator('label:has-text("Description")'),
        saveTemplateDescInput: page.locator('[data-modal-content="true"]').locator('textarea[placeholder*="template description"]'),
        saveTemplateCancelBtn: page.locator('[data-modal-content="true"]').locator('button:has-text("Cancel")'),
        saveTemplateSaveBtn: page.locator('[data-modal-content="true"]').locator('button:has-text("Save Template")'),

        notificationRoot: page.locator('.mantine-Notifications-root .mantine-Notification-root'),
        notificationRootFirst: page.locator('.mantine-Notifications-root .mantine-Notification-root').first(),

        agCenterColsVisible: page.getByRole('tabpanel', { name: 'Bids' }).locator('.ag-center-cols-container:visible'),
        firstAgRow: page.locator('[role="treegrid"]:has([role="columnheader"]:has-text("Scope"))').locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }).first(),
        agRowCells: () => page.locator('[role="treegrid"]:has([role="columnheader"]:has-text("Scope"))').locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }).first().locator('[role="gridcell"]'),
        agCellEditorInput: page.locator('.ag-cell-edit-input, input.ag-input-field-input, input'),
        agCellEditorTextarea: page.locator('textarea'),
        revoCellEditorInput: page.locator('input[data-testid="bird-table-text-input"], input[data-testid="bird-table-number-input"], input[data-testid="bird-table-currency-input"]'),
        revoCellEditorTextarea: page.locator('textarea'),
        bidsGridRootWithActions: page.getByRole('tabpanel', { name: 'Bids' }).locator('.ag-root:has-text("Actions")').first(),

        bidQuantityCell: page.getByRole('tabpanel', { name: 'Bids' }).locator('div[role="gridcell"][data-rgcol="4"][data-rgrow="0"]').first(),
        bidUnitCostCell: page.getByRole('tabpanel', { name: 'Bids' }).locator('div[role="gridcell"][data-rgcol="5"][data-rgrow="0"]').first(),

        bidQuantityCell1: page
            .locator('revo-grid')
            .locator('[role="row"][aria-rowindex="0"] [role="gridcell"][aria-colindex="4"]').first(),

        bidUnitCostCell1: page
            .locator('revo-grid')
            .locator('[role="row"][aria-rowindex="0"] [role="gridcell"][aria-colindex="5"]').first(),

        filterButton: page.getByRole('button').filter({ has: page.locator('svg.lucide-funnel') }),
        exportButton: page.locator('button:has(svg.lucide-download)').first(),
        // deleteRowBtn: page.locator('button[aria-label="Delete Row"]').first(),
        deleteRowBtn: page.locator(
            'revo-grid revogr-viewport-scroll.colPinEnd button:has(svg.lucide-trash2)'
        ).first(),

        deleteConfirmBtn: page.locator(".mantine-Popover-dropdown button:has-text('Delete')"),

        // Manage Vendors section locators
        vendorActionBtn: page.getByRole('tabpanel', { name: 'Bids' }).locator('button:has(svg.lucide-ellipsis-vertical)').first(),
        awardBidOption: page.locator('text=Award Bid').first(),
        editOnBehalfOption: page.locator('text=Edit On Behalf of Vendor').first(),
        resendBidOption: page.locator('text=Resend Bid').first(),
        removeFromBidOption: page.locator('text=Remove from Bid').first(),

        // Award Bid modal locators
        awardBidModal: page.locator('section[role="dialog"]'),
        awardBidConfirmBtn: page.locator('button:has-text("Award")').first(),
        awardBidCancelBtn: page.locator('button:has-text("Cancel")').first(),

        // Edit On Behalf Drawer locators
        editBidDrawer: page.locator('[role="dialog"]'),
        submitBidBtn: page.locator('button:has-text("Submit Bid")'),

        // Bid Book section locators
        bidBookSection: page.locator('[role="button"]:has-text("Bid Book")'),
        contractsTab: page.getByRole('tab', { name: 'Contracts' }),
        // First delete (trash) button in Bids grid - for clearing existing bids (treegrid or revo-grid)
        bidsFirstDeleteBtn: page.getByRole('tabpanel', { name: 'Bids' }).locator('button:has(svg.lucide-trash2)').first(),

        // ============ BID LEVELLING ============
        bidLevellingTab: page.getByRole('tab', { name: 'Bid Levelling' }),
        bidBookTab: page.getByRole('tab', { name: 'Bid Book' }),
        bidLevellingGrid: page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="treegrid"], [role="grid"]').first(),
        bidLevellingHeaders: page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="columnheader"]'),
        bidLevellingRows: page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }),
        bidLevellingCells: page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="gridcell"]'),
        bidLevellingTotalRow: page.getByRole('tabpanel', { name: 'Bids' }).locator('[role="row"]:has-text("$")').last(),
    };
}

module.exports = { projectJobLocators };
