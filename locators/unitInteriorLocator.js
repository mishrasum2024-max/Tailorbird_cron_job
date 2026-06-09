/**
 * Unit Interior Locators
 * Scope: Jobs → Job Detail → Contracts tab → Units sub-tab
 * Job: "Automation Job, please don't delete it" (ID 3828)
 *
 * Grid columns (in order):
 *   [0] toggle (› expand button, only on Released rows)
 *   [1] checkbox
 *   [2] Unit  (number e.g. "101")
 *   [3] FP Type
 *   [4] Unit Type
 *   [5] Status
 *   [6] Start Date
 *   [7] End Date
 *   [8] Days In Renovation
 *
 * Toolbar buttons (always visible, enabled/disabled based on selection):
 *   Edit Scopes  – disabled always (scope editing is not allowed via this path)
 *   Update Status – enabled only when a row with a toggle (Released row) is selected
 *   Release Units – enabled as soon as any row is checked
 *
 * Update Status dropdown options:
 *   Not in Reno | Released | Not Started | In Progress | Completed | Cancelled
 *
 * Release Units dialog:
 *   Title:    "Release Units with Scopes"
 *   Subtitle: "Select which scopes apply to each unit before releasing them"
 *   Table headers: Units | Bid with material | Bid without material
 *   Action: "Release with Scopes"
 */

function unitInteriorLocators(page) {
    return {

        // ── Left navigation ───────────────────────────────────────────────────
        jobsNavLink: page.locator('nav')
            .locator('a, button, div')
            .filter({ hasText: /^Jobs \(Contracts & POs\)$/i })
            .first(),

        // ── Jobs listing toolbar ──────────────────────────────────────────────
        jobsListSearchInput: page.locator('input[placeholder="Search..."]').first(),

        // ── Job-level tab list ────────────────────────────────────────────────
        jobSummaryTab:   page.getByRole('tab', { name: 'Job Summary' }),
        bidsTab:         page.getByRole('tab', { name: 'Bids' }),
        contractsTab:    page.getByRole('tab', { name: 'Contracts' }),
        changeOrdersTab: page.getByRole('tab', { name: 'Change Orders' }),
        invoiceTab:      page.getByRole('tab', { name: 'Invoice' }),

        // ── Contracts tab panel ───────────────────────────────────────────────
        contractsTabPanel: page.getByRole('tabpanel', { name: 'Contracts' }),

        // Inner sub-tabs inside Contracts panel — exact: true prevents "Contract" matching "Contracts"
        contractSubTab:  page.getByRole('tab', { name: 'Contract', exact: true }),
        unitsSubTab:     page.getByRole('tab', { name: 'Units',    exact: true }),
        documentsSubTab: page.getByRole('tab', { name: 'Documents', exact: true }),

        // ── Units panel (the active tabpanel after clicking Units sub-tab) ────
        unitsPanel: page.getByRole('tabpanel', { name: 'Units' }),

        // ── Units toolbar ─────────────────────────────────────────────────────
        unitSearchInput: page.getByRole('textbox', { name: 'Search by unit name' }),

        // Action buttons – each has a different enabled/disabled rule (see module doc)
        editScopesBtn:   page.getByRole('button', { name: 'Edit Scopes' }),
        updateStatusBtn: page.getByRole('button', { name: 'Update Status' }),
        releaseUnitsBtn: page.getByRole('button', { name: 'Release Units' }),

        // ── Grid: column headers (scoped to Units panel to avoid collision) ───
        selectAllHeaderCheckbox: page.getByRole('tabpanel', { name: 'Units' })
            .locator('[role="treegrid"]')
            .getByRole('columnheader')
            .getByRole('checkbox')
            .first(),

        unitColHeader:       page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'Unit' }),
        fpTypeColHeader:     page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'FP Type' }),
        unitTypeColHeader:   page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'Unit Type' }),
        statusColHeader:     page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'Status' }),
        startDateColHeader:  page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'Start Date' }),
        endDateColHeader:    page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'End Date' }),
        daysInRenoColHeader: page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'Days In Renovation' }),
        actionsColHeader:    page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('columnheader', { name: 'Actions' }),

        // ── Grid: data rows ───────────────────────────────────────────────────

        // All data rows (rows that have at least one checkbox in them)
        allGridRows: page.getByRole('tabpanel', { name: 'Units' })
            .locator('[role="treegrid"]')
            .getByRole('row')
            .filter({ has: page.getByRole('checkbox') }),

        // Row locator by unit number – works regardless of current status text
        rowByUnitNum: (num) => page.getByRole('tabpanel', { name: 'Units' })
            .locator('[role="treegrid"]')
            .getByRole('row')
            .filter({
                has: page.getByRole('gridcell')
                    .filter({ hasText: new RegExp(`^\\s*${num}\\s*$`) })
            })
            .first(),

        // Checkbox within a specific unit row
        rowCheckboxByUnitNum: (num) => page.getByRole('tabpanel', { name: 'Units' })
            .locator('[role="treegrid"]')
            .getByRole('row')
            .filter({
                has: page.getByRole('gridcell')
                    .filter({ hasText: new RegExp(`^\\s*${num}\\s*$`) })
            })
            .first()
            .getByRole('checkbox'),

        // Expand toggle button (› ) – only present on Released/toggle rows (105, 106, 107)
        rowToggleBtnByUnitNum: (num) => page.getByRole('tabpanel', { name: 'Units' })
            .locator('[role="treegrid"]')
            .getByRole('row')
            .filter({
                has: page.getByRole('gridcell')
                    .filter({ hasText: new RegExp(`^\\s*${num}\\s*$`) })
            })
            .first()
            .getByRole('button', { name: '›' }),

        // Unit actions kebab button in the Actions column per row
        unitActionsBtnByUnitNum: (num) => page.getByRole('tabpanel', { name: 'Units' })
            .locator('[role="treegrid"]')
            .getByRole('row')
            .filter({
                has: page.getByRole('gridcell')
                    .filter({ hasText: new RegExp(`^\\s*${num}\\s*$`) })
            })
            .first()
            .getByRole('button', { name: 'Unit actions' }),

        // ── Update Status dropdown menu ───────────────────────────────────────
        updateStatusMenu: page.getByRole('menu', { name: 'Update Status' }),

        // Single menuitem by exact label
        statusMenuOption: (name) => page.getByRole('menuitem', { name }),

        // All expected option labels in order (used for assertions)
        EXPECTED_STATUS_OPTIONS: [
            'Not in Reno',
            'Released',
            'Not Started',
            'In Progress',
            'Completed',
            'Cancelled',
        ],

        // ── Release Units dialog ──────────────────────────────────────────────
        releaseUnitsDialog: page.getByRole('dialog'),

        // Expected text constants (avoids magic strings in tests)
        RELEASE_DIALOG_TITLE:    'Release Units with Scopes',
        RELEASE_DIALOG_SUBTITLE: 'Select which scopes apply to each unit before releasing them',

        // Dialog controls
        selectAllScopesCheckbox: page.getByRole('checkbox', { name: 'Select all scopes' }),
        applyToAllUnitsBtn:      page.getByRole('button', { name: 'Apply same Scope to all Units' }),
        releaseWithScopesBtn:    page.getByRole('button', { name: 'Release with Scopes' }),
        closeReleaseDialogBtn:   page.getByRole('button', { name: 'Close' }),

        // Dialog table column headers
        dialogUnitsColHeader:          page.getByRole('dialog').getByRole('columnheader', { name: 'Units' }),
        dialogBidWithMaterialHeader:   page.getByRole('dialog').getByRole('columnheader', { name: 'Bid with material' }),
        dialogBidWithoutMaterialHeader:page.getByRole('dialog').getByRole('columnheader', { name: 'Bid without material' }),

        // Dialog table body rows
        dialogTableBodyRows: page.getByRole('dialog').locator('tbody tr'),

        // Unit-scope checkbox e.g. "105 — Bid with material"
        dialogScopeCheckbox: (label) => page.getByRole('checkbox', { name: label }),

        // ── Expected static values (used across test assertions) ─────────────

        EXPECTED_COL_HEADERS: [
            'Unit',
            'FP Type',
            'Unit Type',
            'Status',
            'Start Date',
            'End Date',
            'Days In Renovation',
        ],

        EXPECTED_BUTTONS: ['Edit Scopes', 'Update Status', 'Release Units'],

        EXPECTED_DIALOG_TABLE_HEADERS: ['Units', 'Bid with material', 'Bid without material'],

        KNOWN_STATUS_VALUES: [
            'Not in Reno',
            'Released',
            'Not Started',
            'In Progress',
            'Completed',
            'Cancelled',
        ],

        // Units observed with the › toggle (Released rows) in the test job
        TOGGLE_UNITS: [105, 106, 107],

        // Units observed without the toggle (Not in Reno rows) in the test job
        PLAIN_UNITS: [101, 102, 103, 104, 108, 201],

        // ── Filter panel ─────────────────────────────────────────────────────
        // Filter button scoped to unitsPanel — avoids collision with Filter buttons
        // in Bids, Change Orders and Invoice panels
        filterButton: page.getByRole('tabpanel', { name: 'Units' })
            .getByRole('button', { name: 'Filter' }),

        // Filter popover — scoped to dialogs that contain a "Filters" heading paragraph
        filterDialog: page.locator('[role="dialog"]')
            .filter({ has: page.locator('p').filter({ hasText: 'Filters' }) }),

        // Filter textboxes (combobox-style — clicking opens a listbox of options)
        filterStatusInput:   page.getByRole('textbox', { name: 'Status' }),
        filterFpTypeInput:   page.getByRole('textbox', { name: 'FP Type' }),
        filterUnitTypeInput: page.getByRole('textbox', { name: 'Unit Type' }),

        // Listboxes that appear when the corresponding filter textbox is clicked
        filterStatusListbox:   page.getByRole('listbox', { name: 'Status' }),
        filterFpTypeListbox:   page.getByRole('listbox', { name: 'FP Type' }),
        filterUnitTypeListbox: page.getByRole('listbox', { name: 'Unit Type' }),

        // "Clear all" button — only rendered in the filter panel when ≥1 filter is active
        clearAllFiltersBtn: page.getByRole('button', { name: 'Clear all' }),

        // 0-based column indices within each data row's gridcells:
        //   0=toggle  1=checkbox  2=Unit  3=FP Type  4=Unit Type  5=Status
        FILTER_COL: { fpType: 3, unitType: 4, status: 5 },
    };
}

module.exports = { unitInteriorLocators };
