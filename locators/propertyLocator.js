export const propertyLocators = {
    // ============ TABLE HEADERS & STRUCTURE (REVOGRID) ============
    tableViewHeader: '[role="columnheader"]',
    tableScrollContainer: '[role="treegrid"]',
    tableHeaders: '[role="columnheader"]',
    tableRows: '[role="row"]',
    tableRowCells: '[role="gridcell"]',
    gridRootWrapper: "[role='treegrid']",
    
    // ============ ROW & CELL OPERATIONS ============
    firstRowNameCell: '[role="row"]:first-of-type [role="gridcell"]:first-of-type',
    firstRowNameCellText: '[role="row"]:first-of-type [role="gridcell"]:first-of-type div',
    propertyNameCell: name => `[role="gridcell"]:has-text("${name}")`,
    rowFromCell: "xpath=ancestor::div[@role='row']",
    /** Actions column: trash uses aria-label="Delete Property" and lucide-trash2 (live properties table HTML). */
    rowDeleteIcon: rowIndex =>
        `[role="row"][data-rgrow="${rowIndex}"] button[aria-label="Delete Property"], [role="row"][data-rgrow="${rowIndex}"] button:has(svg[class*="lucide-trash"])`,
    
    // ============ FILTERS & ACTIONS (BirdTable FilterPopup) ============
    filterBadges: '[role="treegrid"] .mantine-Badge-label',
    filterPanelTitle: ".mantine-Paper-root p:has-text('Filters')",
    filterCheckbox: value => `input[value="${value}"]`,
    clearAllFiltersLink: '.mantine-Paper-root a:has-text("Clear All Filters")',
    resetFiltersButton: 'button:has-text("Reset Filters")',
    
    // ============ TABS (TAKEOFFS) — UI labels (was Interior / Exterior) ============
    interiorTab: '[role="tab"]:has-text("Floor Plans")',
    exteriorTab: '[role="tab"]:has-text("Building Exterior")',
    assetViewerTab: 'button[role="tab"]:has-text("Asset Viewer")',
    locationsTab: 'button[role="tab"]:has-text("Locations")',
    
    // ============ NAVIGATION & VIEWS ============
    propertiesNavLink: ".mantine-NavLink-root:has-text('Properties')",
    breadcrumbsProperties: ".mantine-Breadcrumbs-root:has-text('Properties')",
    propertiesBreadcrumbByName: name => `.mantine-Breadcrumbs-root:has-text('${name}')`,
    propertiesGridCardByName: name => `.mantine-SimpleGrid-root p:has-text('${name}')`,
    layoutListIcon: "button:has-text('Layout')",
    viewMenuItemLabel: view => `.mantine-Menu-itemLabel:has-text('${view}')`,
    
    // ============ CREATE/EDIT PROPERTY ============
    createPropertyButton: "button:has-text('Create Property')",
    /** Prefer PropertiesHelper.addPropertyDialog() — Mantine heading level/title class changed in newer builds. */
    addPropertyModalHeader: "[role='dialog'] .mantine-Modal-title, [role='dialog'] .mantine-Modal-header",
    /** Mantine Autocomplete (GoogleMapsAutocomplete): options are `.mantine-Autocomplete-option`; listbox/role=option can be "hidden" to Playwright when portaled. */
    addressSuggestion: address =>
        `.mantine-Popover-dropdown .mantine-Autocomplete-option[data-combobox-option]:has-text("${address}")`,
    /** Property type uses Mantine Select; match open dropdown options like other suites (e.g. approval). */
    propertyTypeOption: type => `.mantine-Popover-dropdown .mantine-Select-option:has-text("${type}")`,
    
    // ============ BUTTONS & ACTIONS ============
    /** Revogrid row: view is ActionIcon + lucide-eye (no title in current bird-table cell renderer). */
    viewDetailsButton:
        '[role="treegrid"] button:has(svg.lucide-eye), [role="treegrid"] button[title="View Details"]',
    viewDetailsBtn:
        '[role="treegrid"] button:has(svg.lucide-eye), [role="treegrid"] button[title="View Details"]',
    deleteButtonInPopover: '[role="dialog"] button:has-text("Delete")',
    deleteConfirmBtn: ".mantine-Popover-dropdown button:has-text('Delete')",
    assetViewer: 'button:has-text("Asset Viewer")',
    selectall: 'button:has-text("Select All")',
    selectNone: 'button:has-text("Select None")',
    cancelbtn: 'button:has-text("Cancel")',
    selectDownload: 'button:has-text("Download Selected")',
    downloadIcon: '.lucide-download',
    
    // ============ SEARCH & FILTER ============
    /** BirdTable wraps the grid search; fall back to plain placeholder if markup shifts. */
    searchInput: '.bird-table-search-input input[placeholder="Search..."], input[placeholder="Search..."]',
    /**
     * Toolbar: Layout/Filter/View/Table/Export all use data-table-action="true"; Export alone uses lucide-download
     * (live /properties?tab=property-access HTML, Mantine Button + leftSection icon).
     */
    birdTableExportButton: 'button[data-table-action="true"]:has(svg.lucide-download)',
    /** Filter control in the same toolbar group as Export. */
    birdTableFilterButton: 'button[data-table-action="true"]:has(svg.lucide-funnel)',
    exportButton:
        'button[data-table-action="true"]:has(svg.lucide-download), button[aria-label="Export"], button:has-text("Export")',
    
    // ============ PROPERTY DOCUMENTS ============
    documentsHeader: 'text=Property Documents',
    documentsSubHeader: 'text=Files and images related to this property',
    propertyDocumentsTitle: 'p.mantine-Text-root:has-text("Property Documents")',
    uploadFilesBtn: 'button:has-text("Upload Files")',
    uploadFilesButton: 'role=button[name="Upload Files"]',
    uploadDialog: 'dialog[open]',
    uploadFileInput: 'input[type="file"]',
    uploadListDialog: 'dialog[open] uc-upload-list',
    
    // ============ COLUMN MANAGEMENT ============
    tableSettingsButton: 'button:has(svg.lucide-settings)',
    manageColumnsDrawer: 'section[role="dialog"]',
    deleteColumnIcon: ".mantine-Group-root:has-text('Random Name') .lucide-trash2",
    addDataButton: '[data-testid="bt-table-action"]',
    addColumn: '[data-testid="bt-table-action"]',
    nameInput: 'input[placeholder^="Enter column name"]',
    nameInputModal: 'input[placeholder^="Enter column name"]',
    descInput: 'input[placeholder^="Enter column description"]',
    typeButtons: 'div[style*="grid-template-columns"] button',
    submitButton: 'button:has-text("Add column"):not([disabled])',
    submitAddColumn: 'button:has-text("Add column"):not([disabled])',
};
