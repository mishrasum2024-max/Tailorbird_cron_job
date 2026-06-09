const { expect } = require("@playwright/test");
const organizationLocators = require("../locators/organization");
const data = require("../fixture/organization.json");

class OrganizationHelper {
  constructor(page) {
    this.page = page;
  }

  /**
   * Organization → Users tab search field, scoped to the main app shell so we never target a hidden
   * global “Search” control from another surface (MCP + TC13: visible User search only).
   */
  organizationUsersTabSearchInput() {
    const mainContent = this.page.locator(".mantine-AppShell-main").first();
    return mainContent
      .getByRole("textbox", { name: /^User search$/i })
      .or(mainContent.locator(organizationLocators.searchInputPlaceholder))
      .or(
        mainContent.getByRole("textbox", {
          name: /search by name or e-mail|search by name or email/i,
        }),
      )
      .first();
  }

  log(msg) {
    console.log(`[OrganizationHelper] ${msg}`);
  }

  fillDynamic(str, email) {
    return str.replace("{{email}}", email);
  }

  async goto(url) {
    const startTime = Date.now();
    try {
      this.log(`Navigating to URL: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });

      const appShell = this.page
        .locator('.mantine-AppShell-main, .mantine-AppShell-navbar, main')
        .first();

      const loaded = await appShell
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

      if (loaded) {
        this.log(`Navigation successful: ${url} (${Date.now() - startTime}ms)`);
        return;
      }

      for (let i = 0; i < 3; i++) {
        await this.page.waitForTimeout(5000);
        const ok = await appShell.isVisible().catch(() => false);
        if (ok) {
          this.log(`Navigation successful after extra ${(i + 1) * 5}s: ${url} (${Date.now() - startTime}ms)`);
          return;
        }
        this.log(`[goto] App shell not yet visible after ${(i + 1) * 5}s extra wait`);
      }

      this.log(`[goto] WARNING: App shell not visible after ${Date.now() - startTime}ms for ${url} — proceeding anyway`);
    } catch (err) {
      this.log(`ERROR navigating to ${url} after ${Date.now() - startTime}ms: ${err}`);
      throw err;
    }
  }

  async goToOrganization() {
    const navbar = this.page.locator('.mantine-AppShell-navbar');
    const avatar = navbar.locator('.mantine-Avatar-root').last();
    // CI can be slow to render the user avatar after the app shell appears — try once, reload, retry
    const avatarVisible = await avatar.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false);
    if (!avatarVisible) {
      this.log('Avatar not found after 30s — reloading page and retrying');
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);
      await avatar.waitFor({ state: 'visible', timeout: 30_000 });
    }
    await avatar.click();

    const menu = this.page
      .locator('[role="menu"]')
      .filter({ has: this.page.getByRole('menuitem', { name: /^Logout$/i }) })
      .first();
    await menu.waitFor({ state: 'visible', timeout: 15_000 });

    const itemLabels = (await menu.getByRole('menuitem').allInnerTexts()).map((t) => t.trim());
    console.log(`[OrganizationHelper] User menu items: ${JSON.stringify(itemLabels)}`);

    // Product copy: user shell shows "Manage Organization" (see ClientWrapper.tsx); legacy tests referenced "Manage Team".
    const manageEntry = this.page
      .getByRole("menuitem", { name: /^(Manage Team|Manage Organization)$/i })
      .or(this.page.getByRole("button", { name: /^(Manage Team|Manage Organization)$/i }));
    await manageEntry.first().waitFor({ state: "visible", timeout: 20_000 });
    await manageEntry.first().click();

    const crumbs = this.page.locator(".mantine-Breadcrumbs-root");
    await expect(
      crumbs.filter({ hasText: /Organization|Team/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.page).toHaveURL(/\/(organization|manage-team)(\/.+)?([?#]|$)/i);
  }

  /** User menu → Manage User Roles (property × role matrix; replaces legacy /manage-team for roles UI). */
  async goToUserRoleManagement() {
    const navbar = this.page.locator('.mantine-AppShell-navbar');
    await navbar.locator('.mantine-Avatar-root').last().waitFor({ state: 'visible', timeout: 20_000 });
    await navbar.locator('.mantine-Avatar-root').last().click();

    const menu = this.page
      .locator('[role="menu"]')
      .filter({ has: this.page.getByRole('menuitem', { name: /^Logout$/i }) })
      .first();
    await menu.waitFor({ state: 'visible', timeout: 15_000 });

    await this.page.getByRole('menuitem', { name: /Manage User Roles/i }).first().waitFor({ state: 'visible', timeout: 20_000 });
    await this.page.getByRole('menuitem', { name: /Manage User Roles/i }).first().click();

    await expect(this.page).toHaveURL(/\/user-role-management(\/|$|\?)/i, { timeout: 35_000 });
  }

  /**
   * Collects Mantine field errors inside the open invite dialog (exact copy for benchmark tests).
   * @returns {Promise<string[]>}
   */
  async getInviteDialogInputErrors() {
    const dialogRoot = this.page.getByRole("dialog").filter({ hasText: /invite user/i }).first();
    const errs = dialogRoot.locator(".mantine-Input-error");
    const n = await errs.count();
    const texts = [];
    for (let i = 0; i < n; i++) {
      texts.push((await errs.nth(i).innerText()).trim());
    }
    return texts;
  }

  async openInvite() {
    try {
      this.log("Opening Invite User dialog...");
      const inviteUserLauncher = this.page.locator(organizationLocators.inviteButton);
      await inviteUserLauncher.click();
      this.log("Invite button clicked");
      const dialogRoot = this.page.getByRole("dialog").filter({ hasText: /invite user/i }).first();
      await expect(dialogRoot).toBeVisible();
      this.log("Invite dialog opened successfully");
      return {
        dialogRoot,
        emailAddressInput: dialogRoot.getByLabel(/email address(es)?/i),
        roleSelectTrigger: dialogRoot.locator(organizationLocators.dialogRoleSelect),
        confirmInviteButton: dialogRoot.locator(`button:has-text("${data.inviteButtonText}")`),
        nextOrInvitePrimaryButton: dialogRoot.getByRole("button", { name: /^(Next|Invite)$/i }),
      };
    } catch (err) {
      this.log("ERROR opening invite dialog: " + err);
      throw err;
    }
  }

  async selectRole(roleSelectTrigger, roleName, inviteDialogRoot) {
    try {
      const dialogScoped =
        inviteDialogRoot || this.page.getByRole("dialog").filter({ hasText: /invite user/i }).first();
      if ((await roleSelectTrigger.count()) > 0 && (await roleSelectTrigger.first().isVisible().catch(() => false))) {
        await roleSelectTrigger.click();
        await this.page.waitForTimeout(500);
        await this.page.getByRole("option", { name: roleName }).click();
        return;
      }
      const orgAdmin = dialogScoped.getByRole("checkbox", { name: /organization admin/i });
      if (await orgAdmin.isVisible().catch(() => false)) {
        if (roleName === "Admin") await orgAdmin.check();
        else await orgAdmin.uncheck();
      }
      const mapped =
        roleName === "Member"
          ? data.inviteMappedLegacyMemberRole
          : roleName === "Admin"
            ? data.inviteMappedLegacyAdminRole
            : roleName;
      await dialogScoped.getByRole("button", { name: data.inviteOrgRoleTriggerText }).click();
      await this.page.waitForTimeout(500);
      const choicePop = this.page.locator(`[role="option"]`).filter({ hasText: new RegExp(`^${mapped}$`) }).first();
      await expect(choicePop, `Expected organization role option "${mapped}"`).toBeAttached({ timeout: 15_000 });
      await choicePop.evaluate((el) => el.click());
      await expect
        .poll(async () => dialogScoped.getByRole("button", { name: data.inviteWizardNextText }).isEnabled(), {
          timeout: 20_000,
          message: `Next should enable after choosing role "${mapped}" (Manage Team invite drawer)`,
        })
        .toBeTruthy();
    } catch (err) {
      this.log(`ERROR selecting role ${roleName}: ${err}`);
      throw err;
    }
  }

  async inviteUser(email, role) {
    try {
      this.log(`Inviting user: ${email} with role: ${role}`);
      const invitePanel = await this.openInvite();
      await invitePanel.dialogRoot.getByText("Loading roles",{timeout: 10000}).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});
      this.log(`Filling email...${email}`);
      await invitePanel.emailAddressInput.fill(email,{delay: 50});
      this.log(`Selecting role: ${role}`);
      await this.selectRole(invitePanel.roleSelectTrigger, role, invitePanel.dialogRoot);
      this.log("Advancing invite wizard (Next)...");
      await invitePanel.nextOrInvitePrimaryButton.evaluate((el) => el.click());
      await this.page.waitForTimeout(5000);
      const confirmInvite = invitePanel.dialogRoot.getByRole("button", { name: data.inviteButtonText, exact: true });
      if (await confirmInvite.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await confirmInvite.evaluate((el) => el.click());
        // Wait for the invite dialog to close — signals the backend accepted the invite
        await invitePanel.dialogRoot.waitFor({ state: "hidden", timeout: 40_000 }).catch(() => {});
      }
      // Reload to ensure the member table reflects the backend's latest state.
      // Without this, a slow CI server may not push the new member row before the 120s wait expires.
      await this.page.reload({ waitUntil: 'networkidle' }).catch(() => {});
      await this.page.waitForTimeout(7500);
      const inviteDialog = invitePanel.dialogRoot;
      if (
        await inviteDialog
          .getByRole("heading", { name: "Create role" })
          .isVisible()
          .catch(() => false)
      ) {
        throw new Error(
          "Invite drawer advanced to ‘Create role’ — organization role was not applied; check Mantine Select / overlay handling.",
        );
      }
      this.log("Waiting for invited user to appear in grid...");
      // Filter the member table by email so the newly invited (pending) user is visible even if the grid is paginated
      const _memberSearch = this.page.locator("input[placeholder*=’Search’], input[type=’search’]").first();
      if (await _memberSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
        await _memberSearch.fill(email);
        await this.page.waitForTimeout(1500);
      }
      await expect(this.page.locator("table tbody tr.rt-TableRow").filter({ hasText: email }).first()).toBeVisible({
        timeout: 120_000,
      });
      if (await invitePanel.dialogRoot.isVisible().catch(() => false)) {
        await this.page.keyboard.press("Escape");
      }
      this.log(`User invited successfully → ${email}`);
    } catch (err) {
      this.log(`ERROR inviting user ${email}: ${err}`);
      throw err;
    }
  }

  async search(searchQuery) {
    try {
      this.log(`Searching for: ${searchQuery}`);
      const userSearchInput = this.organizationUsersTabSearchInput();
      await userSearchInput.waitFor({ state: "visible", timeout: 60_000 });
      await userSearchInput.fill(searchQuery);
      await this.page.waitForTimeout(1800);
      this.log(`Search completed: ${searchQuery}`);
    } catch (err) {
      this.log(`ERROR searching ${searchQuery}: ${err}`);
      throw err;
    }
  }

  async gotoOrganizationWorkspace() {
    await this.goto(process.env.DASHBOARD_URL || data.dashboardUrl);
    await this.goToOrganization();
  }

  /** Clears organization user search (regression / reset between cases). */
  async clearOrganizationSearch() {
    await this.page.locator(".mantine-AppShell-main").first().waitFor({ state: "visible", timeout: 60_000 });
    const userSearchInput = this.organizationUsersTabSearchInput();
    await userSearchInput.waitFor({ state: "visible", timeout: 60_000 });
    await userSearchInput.fill("");
    await this.page.waitForTimeout(800);
  }

  async validateInvitedBadge(row, email) {
    try {
      this.log(`Validating 'Invited' badge for: ${email}`);
      const invitedBadge = row.locator(`span.rt-Badge.woswidgets-badge:has-text("${data.invitedBadgeText}")`);
      await expect(invitedBadge).toBeVisible({ timeout: 4000 });
      this.log(`'Invited' badge is visible for: ${email}`);
      return true;
    } catch (err) {
      this.log(`❌ ERROR validating Invited badge for ${email}: ${err}`);
      throw err;
    }
  }

  async visibleRowCount() {
    try {
      const count = await this.page.locator("table tbody tr.rt-TableRow").count();
      this.log(`Visible row count: ${count}`);
      return count;
    } catch (err) {
      this.log("ERROR fetching visible row count: " + err);
      throw err;
    }
  }

  async getRow(text) {
    try {
      this.log(`Locating row with text: ${text}`);
      const row = this.page.locator("table tbody tr.rt-TableRow").filter({ hasText: text }).first();
      await row.waitFor({ state: "visible", timeout: 15000 });
      this.log(`Row found for: ${text}`);
      return row;
    } catch (err) {
      this.log(`ERROR locating row for ${text}: ${err}`);
      throw err;
    }
  }

  async revoke(row, email) {
    try {
      this.log(`Revoking invitation for: ${email}`);
      const menu = row.locator(organizationLocators.userActionsBtn);
      await menu.click();
      this.log("Opened user action menu.");
      await this.page.locator(organizationLocators.menuItemRevoke).click();
      this.log("Clicked 'Revoke invite'.");
      const modal = this.page.locator(organizationLocators.modal);
      await expect(modal).toBeVisible({ timeout: 5000 });
      this.log("Revoke modal visible.");
      const title = modal.locator(organizationLocators.modalTitle);
      await expect(title).toHaveText(data.revokeDialogTitle);
      this.log("Revoke dialog title validated.");
      const expectedMsg = this.fillDynamic(data.revokeDialogMessage, email);
      const msgLocator = modal.locator("p");
      const actualMsg = (await msgLocator.innerText()).trim();
      this.log("Extracted message: " + actualMsg);
      await expect(msgLocator).toHaveText(expectedMsg);
      this.log("Revoke message validated.");
      await modal.locator(`button:has-text("${data.revokeConfirmButton}")`).click();
      this.log("Clicked revoke confirm.");
      await modal.waitFor({ state: "hidden" });
      this.log(`Invitation revoked for ${email}.`);
    } catch (err) {
      this.log(`❌ ERROR revoking invitation for ${email}: ${err}`);
      throw err;
    }
  }

  async verifyNoResults() {
    try {
      this.log("Verifying organization user search empty state...");
      // Live copy (MCP beta 2026-05-05): `No users found for query '<search term>'` — never assert exact full string.
      const emptyStatePattern = new RegExp(data.noResultsText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      await expect(this.page.getByText(emptyStatePattern)).toBeVisible({ timeout: 15_000 });
      this.log("Empty search state verified.");
    } catch (err) {
      this.log("ERROR verifying no results: " + err);
      throw err;
    }
  }

  async openFirstMenu() {
    try {
      this.log("Opening first row menu...");
      await this.page.locator(organizationLocators.firstRowMenuBtn,{timeout:40000}).click();
      this.log("First row menu opened.");
    } catch (err) {
      this.log("ERROR opening first row menu: " + err);
      throw err;
    }
  }

  async resendInvite(email) {
    try {
      this.log(`Initiating resend invite for: ${email}`);
      await this.page.locator(organizationLocators.menuItemResend).click();
      this.log("Clicked Resend.");
      const firstDialog = this.page.getByRole("alertdialog").filter({ hasText: data.resendDialogTitle });
      await expect(firstDialog).toBeVisible();
      this.log("First Resend dialog visible.");
      await expect(firstDialog.locator("h1")).toHaveText(data.resendDialogTitle);
      this.log("First title validated.");
      const expectedMsg = this.fillDynamic(data.resendDialogMessage, email);
      const msgLocator = firstDialog.locator("p");
      const actualMsg = (await msgLocator.innerText()).trim();
      this.log("First message: " + actualMsg);
      await expect(msgLocator).toHaveText(expectedMsg);
      this.log("First message validated.");
      await firstDialog.locator(`button:has-text("${data.resendConfirmButton}")`).click();
      this.log("Clicked Resend.");
    } catch (err) {
      this.log("❌ ERROR in resendInvite: " + err);
      throw err;
    }
  }

  async verifyResendSuccess(email) {
    try {
      this.log("Verifying resend success second dialog...");
      const secondDialog = this.page.getByRole("dialog").filter({ hasText: data.resendSuccessTitle });
      await expect(secondDialog).toBeVisible();
      this.log("Second dialog visible.");
      await expect(secondDialog.locator("h1")).toHaveText(data.resendSuccessTitle);
      this.log("Second title validated.");
      const expectedMsg = this.fillDynamic(data.resendSuccessMessage, email);
      const msgLocator = secondDialog.locator("p");
      const actualMsg = (await msgLocator.innerText()).trim();
      this.log("Second message: " + actualMsg);
      await expect(msgLocator).toHaveText(expectedMsg);
      this.log("Second message validated.");
      await secondDialog.locator(`button:has-text("${data.resendSuccessCloseButton}")`).click();
      this.log("Clicked Close.");
      await expect(this.page.getByRole("dialog")).toBeHidden({ timeout: 5000 });
      await expect(this.page.getByRole("alertdialog")).toBeHidden({ timeout: 5000 });
      this.log("Both dialogs closed.");
    } catch (err) {
      this.log("❌ ERROR verifying resend success: " + err);
      throw err;
    }
  }

  async toggleRole(row) {
    try {
      this.log("Opening Edit Role...");
      const menu = row.locator(organizationLocators.userActionsBtn);
      await menu.click();
      await this.page.getByRole("menuitem", { name: data.editRoleDialogTitle }).click();
      const modal = this.page.getByRole("dialog").filter({ hasText: data.editRoleDialogTitle });
      await modal.waitFor({ state: "visible", timeout: 10000 });
      const memberCheckbox = modal.getByRole("checkbox", { name: /Member/ });
      const adminCheckbox = modal.getByRole("checkbox", { name: /Admin/ });
      const isAdminChecked = await adminCheckbox.isChecked();
      const isMemberChecked = await memberCheckbox.isChecked();
      const next = (isAdminChecked && !isMemberChecked) ? data.roles[1] : data.roles[0];
      const current = next === data.roles[0] ? data.roles[1] : data.roles[0];
      this.log(`Current: ${current}, Changing to: ${next}`);
      if (next === data.roles[0]) {
        if (isMemberChecked) await memberCheckbox.click();
        if (!(await adminCheckbox.isChecked())) await adminCheckbox.click();
      } else {
        if (isAdminChecked) await adminCheckbox.click();
        if (!(await memberCheckbox.isChecked())) await memberCheckbox.click();
      }
      await modal.getByRole("button", { name: data.saveButtonText }).click();
      await modal.waitFor({ state: "hidden" });
      this.log(`Role changed: ${current} → ${next}`);
      return next;
    } catch (err) {
      this.log("ERROR toggling role: " + err);
      throw err;
    }
  }

  async getRole(email) {
    try {
      this.log(`Fetching role for: ${email}`);
      const row = await this.getRow(email);
      const cell = row.locator("td.rt-TableCell").first();
      const role = (await cell.innerText()).trim();
      this.log(`Current role for ${email}: ${role}`);
      return role;
    } catch (err) {
      this.log("ERROR getting role: " + err);
      throw err;
    }
  }

  async verifyUpdatedRole(email, expectedRole) {
    try {
      this.log(`Verifying updated role for ${email}`);
      await this.page.waitForTimeout(30000);
      const row = await this.getRow(email);
      const roleCell = row.locator("td.rt-TableCell").first();
      const updatedRole = (await roleCell.innerText()).trim();
      this.log(`Fetched updated role: ${updatedRole}`);
      expect(updatedRole).toBe(expectedRole);
      this.log(`Role verification PASSED → ${email}: ${updatedRole} == ${expectedRole}`);
      return updatedRole;
    } catch (err) {
      this.log(`ERROR verifying updated role for ${email}. Expected ${expectedRole}. Error: ${err}`);
      throw err;
    }
  }
}

module.exports = OrganizationHelper;
