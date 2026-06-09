module.exports = {

        // View details
    viewDetailsBtn: 'button[title="View Details"], button:has(svg.lucide-eye)',

    // Location Tab - scope to property details
    locationsTab: 'button[role="tab"]:has-text("Locations")',
    locationsTabpanel: 'role=tabpanel[name="Locations"]',

    // Locations: row actions use bt-add-row (replaces bt-add-row-menu).
    addButton: '[data-testid="bt-add-row"]',
    addSite: '[data-testid="bt-add-row"]',
    addDataOption: 'role=menuitem[name="Add Data"]',
    addUnitOption: 'role=menuitem[name="Add Unit"]',

    // Grid elements
    newRow: 'role=row[name*="—"] >> nth=0',
    nameCell: '[role="gridcell"]:nth-child(1)',
    nameInput: 'input[type="text"]:visible, textarea',
    deleteRowBtn: 'button[title="Delete Row"], button:has(svg.lucide-trash2)',
    deleteConfirmBtn: ".mantine-Popover-dropdown button:has-text('Delete')",

    // Add Column Modal
    modal_AddColumn: 'div.mantine-Paper-root:has-text("Add column")',
    columnNameInput: 'role=textbox[name^="Enter column name"]',
    descriptionInput: 'role=textbox[name^="Enter column description"]',
    addColumnBtn: 'role=button[name="Add column"]',
    

    // SETTINGS Drawer
    tableSettingBtn: 'button:has(svg.lucide-settings):visible',
    settingsDrawer: 'section.mantine-Drawer-content[role="dialog"]',
    drawerTitle: 'h2:has-text("Manage Columns")',
    drawerClose: 'button.mantine-Drawer-close',
    defaultColumnText: 'p:has-text("Default Columns")',
    customColumnsText: 'p:has-text("Custom Columns")',
    deleteColumnIcon: ".mantine-Group-root:has-text('Test Column') .lucide-trash2",

    // Location Dropdown Select
    locationDropdown: 'input[placeholder="Select location type"]',
    locationDropdownOption: (type) => `.mantine-Select-option:has-text("${type}")`,

    // Table Headers / Rows
    unitHeader: 'text=Unit Name',
    tableColumnHeader: (header) => `role=columnheader[name="${header}"]`,
    visibleRows: 'div[role="row"]:visible'
};