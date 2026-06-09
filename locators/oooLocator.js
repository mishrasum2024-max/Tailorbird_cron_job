/**
 * Locators for the Out of Office (OOO) feature.
 * All selectors verified via MCP browser live DOM inspection on 2026-05-26.
 *
 * DOM facts:
 *  - Radio inputs: type="radio" value="user"|"role" inside a Mantine RadioGroup
 *  - Team member & role dropdowns: Mantine Select — rendered as <input> inside a textbox role
 *  - Date picker: Mantine DateInput — placeholder "Pick a date"
 *  - Past dates: data-disabled="true" on .mantine-DateInput-day buttons
 *  - Previous-month nav: first .mantine-DateInput-calendarHeaderControl button, disabled=true when on current month
 *  - Active state: <p> inside tabpanel containing "Active — delegating approvals to"
 *  - POST payload: { delegateRoleId: N, deactivateAt: null|"YYYY-MM-DD" }
 *    OR            { delegateUserId: N, deactivateAt: null|"YYYY-MM-DD" }
 *  - GET /api/ooo response: { success, ooo: null|{id, delegate_user_id, delegate_role_id, deactivate_at, started_at, delegate_role_name}, delegatedFrom, currentUserId }
 */

function oooLocators(page) {
    const oooTabpanel = page.getByRole('tabpanel', { name: 'Out of Office' });

    return {
        // ── Profile page tab strip ─────────────────────────────────────────
        tab_profile:  page.getByRole('tab', { name: 'Profile' }),
        tab_security: page.getByRole('tab', { name: 'Security' }),
        tab_ooo:      page.getByRole('tab', { name: 'Out of Office' }),
        oooTabpanel,

        // ── Delegation type radios ─────────────────────────────────────────
        radio_delegateToUser: page.getByRole('radio', { name: 'Delegate to user' }),
        radio_delegateToRole: page.getByRole('radio', { name: 'Delegate to role' }),

        // ── Dropdowns (Mantine Select — role="textbox") ────────────────────
        input_teamMember: page.getByRole('textbox', { name: 'Select a team member' }),
        input_role:       page.getByRole('textbox', { name: 'Select a role' }),

        // Listbox options — pass the exact option label
        roleOption:   (label) => page.getByRole('option', { name: label }),
        memberOption: (label) => page.getByRole('option', { name: label }),

        // ── Helper text (only visible when "Delegate to role" is selected) ─
        helperText: page.getByText(
            'Approvals will be routed to the person assigned to this role for each property.',
            { exact: true }
        ),

        // ── Auto-deactivate date (Mantine DateInput) ───────────────────────
        input_deactivateDate: page.getByRole('textbox', { name: 'Auto-deactivate on (optional)' }),

        // The × clear button that appears inside the date wrapper after a date is set.
        // Verified live: Mantine renders this as class "mantine-InputClearButton-root".
        btn_clearDate: oooTabpanel.locator('button[class*="InputClearButton"]').first(),

        // ── Calendar pop-over elements ─────────────────────────────────────
        // First calendarHeaderControl is the "previous month" left-arrow nav.
        // Verified: disabled=true when already at current month.
        calendar_prevMonthBtn: page.locator('.mantine-DateInput-calendarHeaderControl').first(),
        calendar_nextMonthBtn: page.locator('.mantine-DateInput-calendarHeaderControl').nth(1),
        calendar_monthLabel:   page.locator('.mantine-DateInput-calendarHeaderLevel'),
        // All day buttons inside the calendar; filter by data-disabled to find past/future dates
        calendar_allDayBtns:   page.locator('.mantine-DateInput-day'),

        // ── Action buttons ─────────────────────────────────────────────────
        btn_activate:   page.getByRole('button', { name: 'Activate OOO mode' }),
        btn_deactivate: page.getByRole('button', { name: 'Deactivate OOO mode' }),

        // ── Active state display ───────────────────────────────────────────
        // Visible only when OOO is active. Contains text like:
        // "Active — delegating approvals to E2E_Test_Role_1730180000 (role)"
        activeStatePara: oooTabpanel
            .locator('p')
            .filter({ hasText: /Active.*delegating approvals to/i }),

        // ── Sidebar user block (used in TC-OOO-012 navigation test) ────────
        sidebarUserBlock: page.locator('nav').getByText(/Sumit Harsh/i).first(),

        // ── Approvals sidebar link ─────────────────────────────────────────
        sidebarApprovalsLink: page.locator('nav').getByText('Approvals').first(),
    };
}

module.exports = { oooLocators };
