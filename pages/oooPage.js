require('dotenv').config();
const { expect } = require('@playwright/test');
const { oooLocators } = require('../locators/oooLocator');
const { Logger } = require('../utils/logger');

class OOOPage {
    constructor(page) {
        this.page = page;
        this.loc = oooLocators(page);
    }

    // ── Internal helpers ─────────────────────────────────────────────────

    /** Returns the API origin derived from DASHBOARD_URL env var. Nothing hardcoded. */
    get apiBase() {
        return new URL(process.env.DASHBOARD_URL).origin;
    }

    async waitForDomLoad(ms = 1500) {
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(ms);
    }

    // ── Navigation ───────────────────────────────────────────────────────

    async navigateToProfile() {
        Logger.step('[OOO] Navigating to /profile');
        await this.page.goto(`${this.apiBase}/profile`, { waitUntil: 'domcontentloaded' });
        await this.loc.tab_profile.waitFor({ state: 'visible', timeout: 20000 });
        Logger.success('[OOO] Profile page loaded');
    }

    async clickOooTab() {
        Logger.step('[OOO] Clicking Out of Office tab');
        await this.loc.tab_ooo.click();
        await this.loc.oooTabpanel.waitFor({ state: 'visible', timeout: 15000 });
        await this.page.waitForTimeout(800);
        Logger.success('[OOO] OOO tabpanel visible');
    }

    async goToOooTab() {
        await this.navigateToProfile();
        await this.clickOooTab();
    }

    // ── API helpers ──────────────────────────────────────────────────────

    /**
     * GET /api/ooo
     * Returns: { success, ooo: null|{id, delegate_user_id, delegate_role_id, deactivate_at, started_at, delegate_role_name}, delegatedFrom, currentUserId }
     */
    async getOooApiState() {
        const res = await this.page.request.get(`${this.apiBase}/api/ooo`);
        expect(res.status(), `GET /api/ooo expected HTTP 200, got ${res.status()}`).toBe(200);
        const body = await res.json();
        Logger.info(`[OOO API State] ${JSON.stringify(body)}`);
        return body;
    }

    /**
     * GET /api/ooo/delegates
     * Returns: { success, members: [{id, label}], roles: [{id, label}] }
     */
    async getDelegatesApiResponse() {
        const res = await this.page.request.get(`${this.apiBase}/api/ooo/delegates`);
        expect(res.status(), `GET /api/ooo/delegates expected HTTP 200, got ${res.status()}`).toBe(200);
        const body = await res.json();
        Logger.info(`[OOO Delegates] members=${body.members.length}, roles=${body.roles.length}`);
        return body;
    }

    /**
     * POST /api/ooo with a raw arbitrary payload.
     * Used for negative/backend-validation tests only.
     * Returns the raw Response object — caller asserts status.
     */
    async postOooDirect(payload) {
        Logger.info(`[POST /api/ooo] payload=${JSON.stringify(payload)}`);
        const res = await this.page.request.post(`${this.apiBase}/api/ooo`, { data: payload });
        Logger.info(`[POST /api/ooo] → HTTP ${res.status()}`);
        return res;
    }

    /**
     * DELETE /api/ooo — used for cleanup.
     * Returns the raw Response object.
     */
    async deleteOooDirect() {
        Logger.info('[DELETE /api/ooo] Sending deactivation request');
        const res = await this.page.request.delete(`${this.apiBase}/api/ooo`);
        Logger.info(`[DELETE /api/ooo] → HTTP ${res.status()}`);
        return res;
    }

    // ── State management ─────────────────────────────────────────────────

    /** Returns true if the active state paragraph is currently visible in the UI. */
    async isOooActiveInUi() {
        return this.loc.activeStatePara.isVisible().catch(() => false);
    }

    /**
     * Ensures OOO is inactive via API. Idempotent — safe to call even if already inactive.
     * Asserts the DELETE returns 200 if a deactivation was needed.
     */
    async ensureOooInactive() {
        const state = await this.getOooApiState();
        if (state.ooo !== null) {
            Logger.info('[OOO] Currently active — deactivating via API');
            const res = await this.deleteOooDirect();
            expect(res.status(), `Cleanup DELETE /api/ooo expected HTTP 200`).toBe(200);
            Logger.success('[OOO] Deactivated successfully');
        } else {
            Logger.info('[OOO] Already inactive — no cleanup needed');
        }
    }

    // ── UI interactions ──────────────────────────────────────────────────

    async selectDelegateToRole() {
        Logger.step('[OOO] Selecting "Delegate to role" radio');
        await this.loc.radio_delegateToRole.click();
        await expect(this.loc.radio_delegateToRole, '"Delegate to role" must be checked after click').toBeChecked({ timeout: 5000 });
        Logger.success('[OOO] "Delegate to role" radio is checked');
    }

    async selectDelegateToUser() {
        Logger.step('[OOO] Selecting "Delegate to user" radio');
        await this.loc.radio_delegateToUser.click();
        await expect(this.loc.radio_delegateToUser, '"Delegate to user" must be checked after click').toBeChecked({ timeout: 5000 });
        Logger.success('[OOO] "Delegate to user" radio is checked');
    }

    async pickRoleFromDropdown(roleName) {
        Logger.step(`[OOO] Opening role dropdown and selecting "${roleName}"`);
        await this.loc.input_role.click();
        await this.loc.roleOption(roleName).waitFor({ state: 'visible', timeout: 10000 });
        await this.loc.roleOption(roleName).click();
        await expect(this.loc.input_role, `Role input must show "${roleName}" after selection`).toHaveValue(roleName, { timeout: 5000 });
        Logger.success(`[OOO] Role "${roleName}" selected`);
    }

    async pickMemberFromDropdown(memberName) {
        Logger.step(`[OOO] Opening team member dropdown and selecting "${memberName}"`);
        await this.loc.input_teamMember.click();
        await this.loc.memberOption(memberName).waitFor({ state: 'visible', timeout: 10000 });
        await this.loc.memberOption(memberName).click();
        await expect(this.loc.input_teamMember, `Team member input must show "${memberName}" after selection`).toHaveValue(memberName, { timeout: 5000 });
        Logger.success(`[OOO] Team member "${memberName}" selected`);
    }

    async openDatePicker() {
        Logger.step('[OOO] Opening date picker');
        await this.loc.input_deactivateDate.click();
        await this.loc.calendar_monthLabel.waitFor({ state: 'visible', timeout: 10000 });
        Logger.success('[OOO] Date picker calendar is open');
    }

    /**
     * Fills the date input with a future date N days from today.
     * Returns the date string in MM/DD/YYYY format (as shown in the UI).
     */
    async setFutureDate(daysFromToday = 3) {
        const target = new Date();
        target.setDate(target.getDate() + daysFromToday);
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        const yyyy = target.getFullYear();
        const uiDate = `${mm}/${dd}/${yyyy}`;
        // Also compute API format YYYY-MM-DD for comparison assertions
        const apiDate = `${yyyy}-${mm}-${dd}`;

        Logger.step(`[OOO] Setting deactivate date: ${uiDate} (API: ${apiDate})`);
        await this.loc.input_deactivateDate.fill(uiDate);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(500);

        Logger.success(`[OOO] Deactivate date set to ${uiDate}`);
        return { uiDate, apiDate };
    }

    /** Clicks today's date in the already-open calendar popup. */
    async clickTodayInCalendar() {
        const todayDay = String(new Date().getDate());
        Logger.step(`[OOO] Clicking today (${todayDay}) in open calendar`);
        // Use :not() in the CSS selector itself — chaining .locator(':not(...)') would look for
        // children of the day button (a leaf node), finding nothing.
        const todayBtn = this.page
            .locator('.mantine-DateInput-day:not([data-disabled="true"])')
            .filter({ hasText: new RegExp(`^${todayDay}$`) })
            .first();
        await todayBtn.waitFor({ state: 'visible', timeout: 5000 });
        await todayBtn.click();
        Logger.success(`[OOO] Today (${todayDay}) clicked in calendar`);
    }

    /**
     * Clears the selected deactivation date using the × (CloseButton) icon.
     * The button only exists when a date has been set.
     */
    async clearDeactivateDate() {
        Logger.step('[OOO] Clearing deactivate date via × button');
        await this.loc.btn_clearDate.waitFor({ state: 'visible', timeout: 8000 });
        await this.loc.btn_clearDate.click();
        await expect(
            this.loc.input_deactivateDate,
            'Date input must be empty after clearing'
        ).toHaveValue('', { timeout: 5000 });
        Logger.success('[OOO] Date cleared — input is empty');
    }

    async clickActivateOoo() {
        Logger.step('[OOO] Clicking "Activate OOO mode"');
        await expect(
            this.loc.btn_activate,
            '"Activate OOO mode" must be enabled before clicking'
        ).toBeEnabled({ timeout: 5000 });
        await this.loc.btn_activate.click();
        await this.loc.activeStatePara.waitFor({ state: 'visible', timeout: 15000 });
        Logger.success('[OOO] OOO activated — active state banner is visible');
    }

    async clickDeactivateOoo() {
        Logger.step('[OOO] Clicking "Deactivate OOO mode"');
        await expect(
            this.loc.btn_deactivate,
            '"Deactivate OOO mode" button must be visible'
        ).toBeVisible({ timeout: 10000 });
        await this.loc.btn_deactivate.click();
        await this.loc.btn_activate.waitFor({ state: 'visible', timeout: 15000 });
        Logger.success('[OOO] OOO deactivated — activate form is visible again');
    }

    /** Returns the full text content of the active state paragraph. */
    async getActiveStateText() {
        const text = await this.loc.activeStatePara.textContent();
        Logger.info(`[OOO] Active state text: "${text}"`);
        return text;
    }

    // ── State assertion helpers ──────────────────────────────────────────

    /**
     * Asserts the UI is in the OOO active state:
     *   - active state banner visible
     *   - Deactivate button visible
     * Pass { withDateLine: true } to also assert the auto-deactivation date line is visible.
     */
    async assertIsActive({ withDateLine = false } = {}) {
        await expect(this.loc.activeStatePara, 'Active state banner must be visible').toBeVisible({ timeout: 10000 });
        await expect(this.loc.btn_deactivate, '"Deactivate OOO mode" button must be visible').toBeVisible({ timeout: 5000 });
        if (withDateLine) {
            await expect(
                this.page.getByText(/Auto-deactivates on/i),
                'Auto-deactivation date line must be visible'
            ).toBeVisible({ timeout: 10000 });
        }
        Logger.success('[OOO] Active state confirmed — banner visible, deactivate visible');
    }

    /**
     * Asserts the UI is fully reset to the inactive (post-deactivation) state:
     *   - active banner hidden
     *   - Activate button visible and disabled
     *   - Deactivate button hidden
     *   - date field empty
     */
    async assertIsInactive() {
        await expect(this.loc.activeStatePara, 'Active banner must be HIDDEN').toBeHidden({ timeout: 10000 });
        await expect(this.loc.btn_activate, '"Activate OOO mode" must be VISIBLE').toBeVisible({ timeout: 5000 });
        await expect(this.loc.btn_activate, '"Activate OOO mode" must be DISABLED — no delegate selected').toBeDisabled({ timeout: 5000 });
        await expect(this.loc.btn_deactivate, '"Deactivate OOO mode" must be HIDDEN').toBeHidden({ timeout: 5000 });
        await expect(this.loc.input_deactivateDate, 'Date field must be empty after reset').toHaveValue('', { timeout: 5000 });
        Logger.success('[OOO] Inactive state confirmed — banner hidden, activate disabled, deactivate hidden, date cleared');
    }

    /**
     * Asserts the active banner text content. Returns the banner text.
     * Options:
     *   - roleName: asserts the banner contains this name
     *   - isRole: asserts the banner contains "(role)"
     */
    async assertActiveBanner({ roleName = null, isRole = false } = {}) {
        const text = await this.getActiveStateText();
        expect(text, 'Active banner must contain the delegation phrase').toContain('Active — delegating approvals to');
        if (roleName) {
            expect(text, `Active banner must contain "${roleName}"`).toContain(roleName);
        }
        if (isRole) {
            expect(text, 'Active banner must contain the "(role)" label').toContain('(role)');
        }
        Logger.success(`[OOO] Active banner confirmed: "${text}"`);
        return text;
    }

    /**
     * Calls getOooApiState() and asserts all fields for a role delegation.
     * apiDate behaviour:
     *   - not passed (undefined): deactivate_at is not checked
     *   - null: asserts deactivate_at IS null (no date was set)
     *   - "YYYY-MM-DD" string: asserts deactivate_at starts with that string (no timezone shift)
     * Returns the raw api state object.
     */
    async assertRoleDelegationApi({ roleName, apiDate = undefined }) {
        const apiState = await this.getOooApiState();
        expect(apiState.success, 'API success flag must be true').toBe(true);
        expect(apiState.ooo, 'API ooo must not be null').not.toBeNull();
        expect(apiState.ooo.id, 'API ooo.id must be assigned').toBeTruthy();
        expect(apiState.ooo.delegate_role_name, `API delegate_role_name must be "${roleName}"`).toBe(roleName);
        expect(apiState.ooo.delegate_user_id, 'API delegate_user_id must be null for role delegation').toBeNull();
        if (apiDate === null) {
            expect(apiState.ooo.deactivate_at, 'API deactivate_at must be null when no date was set').toBeNull();
        } else if (apiDate !== undefined) {
            expect(apiState.ooo.deactivate_at, 'API deactivate_at must not be null when a date was set').not.toBeNull();
            expect(
                apiState.ooo.deactivate_at.startsWith(apiDate),
                `TIMEZONE SHIFT DETECTED: set "${apiDate}", stored "${apiState.ooo.deactivate_at}"`
            ).toBe(true);
        }
        const dateLog = apiDate === undefined ? 'not checked' : (apiDate === null ? 'none' : apiDate);
        Logger.success(`[OOO] Role delegation API confirmed — id=${apiState.ooo.id}, role="${roleName}", date=${dateLog}`);
        return apiState;
    }

    /**
     * Calls getOooApiState() and asserts all fields for a user delegation.
     * Pass apiDate (YYYY-MM-DD) to also assert deactivate_at starts with that date.
     * Returns the raw api state object.
     */
    async assertUserDelegationApi({ apiDate = null } = {}) {
        const apiState = await this.getOooApiState();
        expect(apiState.success, 'API success flag must be true').toBe(true);
        expect(apiState.ooo, 'API ooo must not be null').not.toBeNull();
        expect(apiState.ooo.id, 'API ooo.id must be assigned').toBeTruthy();
        expect(apiState.ooo.delegate_user_id, 'API delegate_user_id must not be null for user delegation').not.toBeNull();
        expect(apiState.ooo.delegate_role_name, 'API delegate_role_name must be null for user delegation').toBeNull();
        if (apiDate) {
            expect(apiState.ooo.deactivate_at, 'API deactivate_at must not be null when a date was set').not.toBeNull();
            expect(
                apiState.ooo.deactivate_at.startsWith(apiDate),
                `TIMEZONE SHIFT DETECTED: set "${apiDate}", stored "${apiState.ooo.deactivate_at}"`
            ).toBe(true);
        }
        Logger.success(`[OOO] User delegation API confirmed — id=${apiState.ooo.id}, delegate_user_id=${apiState.ooo.delegate_user_id}, date=${apiDate || 'none'}`);
        return apiState;
    }

    /**
     * Types a user email into the team member search field and selects the matching option.
     * Uses pressSequentially so the dropdown filters correctly by the typed text.
     */
    async searchAndSelectUser(userEmail) {
        Logger.step(`[OOO] Searching for and selecting user "${userEmail}"`);
        await this.loc.input_teamMember.click();
        await this.loc.input_teamMember.pressSequentially(userEmail, { delay: 50 });
        await this.page.waitForTimeout(800);
        const option = this.page.getByRole('option', { name: userEmail });
        await option.waitFor({ state: 'visible', timeout: 10000 });
        await option.click();
        await expect(
            this.loc.input_teamMember,
            `Team member input must show "${userEmail}" after selection`
        ).toHaveValue(userEmail, { timeout: 5000 });
        Logger.success(`[OOO] User "${userEmail}" selected`);
    }

    /**
     * Re-selects the team member input (3-click to select-all, then press-sequential) — use when
     * the input already has a value and needs replacing with a different user.
     */
    async replaceSelectedUser(userEmail) {
        Logger.step(`[OOO] Replacing delegate user with "${userEmail}"`);
        await this.loc.input_teamMember.click({ clickCount: 3 });
        await this.loc.input_teamMember.pressSequentially(userEmail, { delay: 50 });
        await this.page.waitForTimeout(800);
        const option = this.page.getByRole('option', { name: userEmail });
        await option.waitFor({ state: 'visible', timeout: 10000 });
        await option.click();
        await expect(
            this.loc.input_teamMember,
            `Team member input must show "${userEmail}" after replacing`
        ).toHaveValue(userEmail, { timeout: 5000 });
        Logger.success(`[OOO] Delegate user replaced with "${userEmail}"`);
    }

    /**
     * Attaches a dialog listener to catch any unexpected browser alerts during a test.
     * Returns an object with:
     *   - assertNoAlert(context): hard expect that no alert fired (fails with message if one did)
     *   - message: getter for the captured alert message (null if none appeared)
     */
    attachAlertDetector() {
        let alertMessage = null;
        this.page.on('dialog', async (dialog) => {
            alertMessage = dialog.message();
            Logger.error(`[BUG] Unexpected browser alert: "${dialog.message()}"`);
            await dialog.dismiss();
        });
        return {
            assertNoAlert: (context = '') => {
                expect(
                    alertMessage,
                    `BUG: Unexpected browser alert appeared${context ? ' — ' + context : ''}. Alert: "${alertMessage}"`
                ).toBeNull();
                Logger.info(`[OOO] No alert confirmed${context ? ' — ' + context : ''} ✓`);
            },
            get message() { return alertMessage; },
        };
    }

    // ── Convenience: full activation workflows ───────────────────────────

    /**
     * Full user delegation activation flow: ensure user mode, search + pick user,
     * optionally fill a date, then click Activate.
     */
    async activateWithUser(userEmail, uiDate = null) {
        Logger.step(`[OOO] Activating with user="${userEmail}", date="${uiDate || 'none'}"`);
        await this.selectDelegateToUser();
        await this.searchAndSelectUser(userEmail);
        if (uiDate) {
            await this.loc.input_deactivateDate.fill(uiDate);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(500);
        }
        await this.clickActivateOoo();
        Logger.success(`[OOO] Activated with user "${userEmail}"`);
    }

    /** Activates OOO with a role delegate. Optionally sets a deactivation date. */
    async activateWithRole(roleName, dateStr = null) {
        Logger.step(`[OOO] Activating with role="${roleName}", date="${dateStr || 'none'}"`);
        await this.selectDelegateToRole();
        await this.pickRoleFromDropdown(roleName);
        if (dateStr) {
            await this.loc.input_deactivateDate.fill(dateStr);
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(500);
        }
        await this.clickActivateOoo();
        Logger.success(`[OOO] Activated with role "${roleName}"`);
    }

    // ── Data helpers (use API — nothing hardcoded) ────────────────────────

    /** Returns the first available role label from /api/ooo/delegates. */
    async getFirstRoleName() {
        const d = await this.getDelegatesApiResponse();
        expect(d.roles.length, 'At least one role must exist for OOO role-delegation tests').toBeGreaterThan(0);
        return d.roles[0].label;
    }

    /** Returns a second distinct role label (for re-activation tests). */
    async getSecondRoleName() {
        const d = await this.getDelegatesApiResponse();
        expect(d.roles.length, 'At least 2 roles required for this test').toBeGreaterThanOrEqual(2);
        return d.roles[1].label;
    }

    /** Returns all role labels from /api/ooo/delegates. */
    async getAllRoleNames() {
        const d = await this.getDelegatesApiResponse();
        return d.roles.map(r => r.label);
    }

    /**
     * Returns the current user's display name by cross-referencing
     * the members array in /api/ooo/delegates with currentUserId from /api/ooo.
     */
    async getCurrentUserName() {
        const [state, delegates] = await Promise.all([
            this.getOooApiState(),
            this.getDelegatesApiResponse(),
        ]);
        const currentId = String(state.currentUserId);
        const self = delegates.members.find(m => m.id === currentId);
        expect(self, `Current user id=${currentId} not found in members array`).toBeTruthy();
        Logger.info(`[OOO] Current user: id=${currentId}, name="${self.label}"`);
        return self.label;
    }

    /**
     * Returns the current user's numeric id from /api/ooo.
     */
    async getCurrentUserId() {
        const state = await this.getOooApiState();
        Logger.info(`[OOO] currentUserId=${state.currentUserId}`);
        return state.currentUserId;
    }
}

module.exports = { OOOPage };
