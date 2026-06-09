/**
 * Locators for Financials → Category and shared Category grid/toolbar patterns.
 * @param {import('@playwright/test').Page} page
 */
function categoryPageLocators(page) {
    return {
        financialsNav: page.locator('nav a.mantine-NavLink-root:has-text("Financials")'),
        categoryLink: page
            .locator('a.mantine-NavLink-root:has(span.mantine-NavLink-label:has-text("Category"))')
            .first(),

        // Financials Category uses BirdTable (treegrid). Prefer main-scoped treegrid first so
        // waitForTableToLoad does not spend full timeout on irrelevant/hidden legacy <table> nodes.
        tableSelectors: [
            'main [role="treegrid"]',
            '[role="treegrid"]',
            'main table',
            'table',
            '.ag-root-wrapper',
            '.mantine-Table-root',
            '[role="table"]',
            '[role="grid"]',
        ],

        downloadSelectors: [
            'button:has(svg.lucide-download)',
            'button[title*="Download"]',
            'button[title*="Export"]',
            'button:has-text("Export")',
            'button:has-text("Download")',
        ],

        errorIndicators: [
            'text=/error/i',
            'text=/not found/i',
            'text=/404/i',
            '.mantine-Alert-root[color="red"]',
        ],

        resetTableIcon: page.locator(
            'button[data-variant="subtle"][data-size="md"]:has(svg.lucide-rotate-ccw)'
        ),

        resetModal: page.locator('section[role="dialog"]'),
        resetModalHeader: page.locator('section[role="dialog"]').locator('h2.mantine-Modal-title'),
        resetModalBody: page.locator('section[role="dialog"]').locator('div.mantine-Modal-body p'),
        resetCancelBtn: page.locator('section[role="dialog"]').locator('button:has-text("Cancel")'),
        resetConfirmBtn: page.locator('section[role="dialog"]').locator('button:has-text("Reset Table")'),

        uploadFilesButton: page.getByRole('button', { name: 'Upload Files' }),
        uploadDialog: page.locator('dialog[open], section[role="dialog"]'),
        uploadFileInput: page.locator('input[type="file"]'),
        uploadListDialog: page.locator(
            'dialog[open] uc-upload-list, section[role="dialog"] uc-upload-list, uc-upload-list'
        ),

        manageColumnsDrawer: page.locator('section[role="dialog"]'),
        tableSettingsButton: page.locator('button:has(svg.lucide-settings)'),
        viewDetailsBtn: page.locator('button[title="View Details"]'),
        documentsHeader: page.locator('text=Property Documents'),
        documentsSubHeader: page.locator('text=Files and images related to this property'),

        uploadFilesBtn: page.locator('button.mantine-ActionIcon-root:has(svg.lucide-upload)').first(),
        importDataButton: page.locator('[title="Import Data"]').first(),

        mainContainer: page.locator('main').first(),
        mainSearchInput: page.locator('main input[placeholder="Search..."]').first(),
        filterFunnelBtn: page.locator('button:has(svg.lucide-funnel)').first(),
        filterPopover: page.locator('.mantine-Paper-root:has-text("Filters")').first(),
        filterCloseBtn: page.locator('button.mantine-CloseButton-root').first(),
        filterGlobalSearch: page.getByPlaceholder('Enter values to search for (OR logic)').first(),

        btAddRow: page.getByTestId('bt-add-row'),
        btTableAction: page.getByTestId('bt-table-action'),
        btTableActionAddColumn: page.getByTestId('bt-table-action-add-column'),
        manageColumnsDialog: page
            .getByRole('dialog', { name: 'Manage Columns' })
            .or(page.locator('section[role="dialog"]').filter({ hasText: /Manage Columns/i }))
            .first(),
    };
}

module.exports = { categoryPageLocators };
