const fs = require('fs');
const path = require('path');

const TABS_DISABLED_PATH = path.join(__dirname, '../data/tabsDisabled.json');

/**
 * Reads the tabs disabled state from file (written by TC06 spec).
 * @returns {{ invoiceTabDisabled?: boolean, changeOrderTabDisabled?: boolean } | null}
 */
function getTabsDisabledState() {
    try {
        const data = fs.readFileSync(TABS_DISABLED_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/**
 * Writes the tabs disabled state to file for spec 8 and 9 to consume.
 * @param {{ invoiceTabDisabled: boolean, changeOrderTabDisabled: boolean }} state
 */
function setTabsDisabledState(state) {
    const dataDir = path.dirname(TABS_DISABLED_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(TABS_DISABLED_PATH, JSON.stringify(state), 'utf8');
}

module.exports = { getTabsDisabledState, setTabsDisabledState, TABS_DISABLED_PATH };
