// locators.js
module.exports = {
    /** Mantine AppShell left rail (width 280 expanded / 80 collapsed in ClientWrapper). */
    appShellNavbar: '.mantine-AppShell-navbar',
    /**
     * Header chevron that collapses/expands the whole sidebar (first NavLink in the shell, not a menu item).
     * Prefer this over `firstLeftPanelToggle` for shell-wide collapse tests.
     */
    mainNavbarHeaderToggle: '.mantine-AppShell-navbar a.mantine-NavLink-root',
    leftPanelLabels: 'nav a.mantine-NavLink-root .mantine-NavLink-label, nav a.mantine-NavLink-root',
    leftPanelItem: (label) => `nav a.mantine-NavLink-root:has-text("${label}"), nav a:has-text("${label}")`,
    collapseContainer: 'xpath=following-sibling::div[contains(@class,"mantine-NavLink-collapse")][1]',
    subOptions: 'a.mantine-NavLink-root',
    firstLeftPanelToggle: 'nav a.mantine-NavLink-root',
    profileButton: 'button[aria-label="Profile"]',
    profileMenuOptions: 'div.mantine-Menu-dropdown button[role="menuitem"] div.mantine-Menu-itemLabel'
};
