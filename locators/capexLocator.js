function capexLocators(page) {
    return {
        // ── Page shell ──────────────────────────────────────────────────────────
        breadcrumbCapex:        page.locator('p:has-text("CapEx")').first(),
        breadcrumbHome:         page.locator('a:has-text("Home")').first(),
        yearSelect:             page.locator('.mantine-Select-input').first(),

        // ── Tabs ─────────────────────────────────────────────────────────────────
        tabProperties:          page.getByRole('tab', { name: 'Properties' }),
        tabFund:                page.getByRole('tab', { name: 'Fund' }),
        tabRegion:              page.getByRole('tab', { name: 'Region' }),

        // ── Portfolio / scope filter ──────────────────────────────────────────────
        portfolioFilterBtn:     page.locator('button[aria-haspopup="listbox"]').first(),
        // portfolio search inside the open dropdown (U+2026 = …)
        portfolioSearchInput:   page.locator('input[placeholder="Search properties…"]'),

        // ── Grid toolbar ──────────────────────────────────────────────────────────
        searchInput:            page.locator('input[placeholder="Search..."]'),
        viewBtn:                page.getByRole('button', { name: 'View' }),
        tableBtn:               page.getByRole('button', { name: 'Table' }),
        exportBtn:              page.getByRole('button', { name: 'Export' }),
        viewNameInput:          page.locator('input[placeholder="Enter a view name"]'),
        hideShowColumnsBtn:     page.locator('text=Hide / show columns'),

        // ── Manage Columns drawer ─────────────────────────────────────────────────
        manageColumnsDrawer:    page.locator('[class*="Drawer-content"], [class*="drawer"]').filter({ hasText: 'Manage Columns' }).first(),

        // ── Grid elements ─────────────────────────────────────────────────────────
        columnHeaders:          page.locator('[role="columnheader"]'),
        gridRows:               page.locator('[role="row"]').filter({ has: page.locator('[role="gridcell"]') }),
        gridCells:              page.locator('[role="gridcell"]'),
        treeExpandBtns:         page.locator('button.tree-toggle'),
        totalRow:               page.locator('[role="row"]').filter({ hasText: 'Total' }).last(),

        // Specific column headers
        colHeaderOriginalBudget:     page.getByRole('columnheader', { name: 'Original Budget' }),
        colHeaderBudgetRevision:     page.getByRole('columnheader', { name: 'Budget Revision' }),
        colHeaderCurrentBudget:      page.getByRole('columnheader', { name: 'Current Budget' }),
        colHeaderBudgetRemaining:    page.getByRole('columnheader', { name: 'Budget Remaining' }),
        colHeaderOriginalContract:   page.getByRole('columnheader', { name: 'Original Contract Amount' }),
        colHeaderApprovedCO:         page.getByRole('columnheader', { name: 'Approved Change Orders' }),
        colHeaderCurrentContract:    page.getByRole('columnheader', { name: 'Current Contract Amount' }),
        colHeaderRemainingContract:  page.getByRole('columnheader', { name: 'Remaining Contract Amount' }),
        colHeaderInvoicedAmount:     page.getByRole('columnheader', { name: 'Invoiced Amount' }),
        colHeaderActions:            page.getByRole('columnheader', { name: 'Actions' }),

        // Actions column edit pencil (Mantine ActionIcon on leaf rows)
        editPencilBtn:          page.locator('button.mantine-ActionIcon-root:not(.bird-table-search-btn)').first(),

        // ── Budget Revision modal ─────────────────────────────────────────────────
        revisionDraftBadge:     page.locator('[role="dialog"] .mantine-Badge-label').first(),
        revisionSaveDraftBtn:   page.getByRole('button', { name: 'Save as Draft' }),
        revisionSubmitBtn:      page.getByRole('button', { name: 'Submit for Approval' }),
        revisionTabBudget:      page.getByRole('tab', { name: 'Budget' }),
        revisionTabDocuments:   page.getByRole('tab', { name: 'Documents' }),
        revisionSearchInput:    page.locator('input[placeholder="Search by Category, Item, or Description"]'),
    };
}

module.exports = { capexLocators };
