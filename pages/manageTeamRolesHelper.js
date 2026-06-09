const { expect } = require("@playwright/test");
const OrganizationHelper = require("./organizationHelper");
const organizationUrls = require("../fixture/organization.json");
const roleManagementUiLabels = require("../fixture/manageTeamRoles.json");

/**
 * Navigation + assertions for User Role Management (`/user-role-management`) and Organization (`/organization`).
 * Legacy `/manage-team` routes 404 on beta (MCP 2026-05-05).
 */
class ManageTeamRolesHelper {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.organizationHelper = new OrganizationHelper(page);
  }

  /** Deep-link to roles matrix (session required). */
  async gotoManageTeamRolesViaQuery(dashboardUrl) {
    const start = dashboardUrl || process.env.DASHBOARD_URL || organizationUrls.dashboardUrl;
    const origin = new URL(start).origin;
    await this.page.goto(`${origin}/user-role-management`, { waitUntil: "load", timeout: 90_000 });
    await this.page.waitForLoadState("domcontentloaded");
  }

  /** Dashboard → user menu → Manage User Roles. */
  async landManageTeamViaMenu(dashboardUrl) {
    await this.organizationHelper.goto(dashboardUrl);
    await this.organizationHelper.goToUserRoleManagement();
  }

  /** Dashboard → user menu → Manage Organization (Users / Property access). */
  async landOrganizationWorkspaceViaMenu(dashboardUrl) {
    await this.organizationHelper.goto(dashboardUrl);
    await this.organizationHelper.goToOrganization();
  }

  async openRolesTab() {
    await this.page.getByRole("tab", { name: roleManagementUiLabels.tabRoles }).click();
  }

  async openUsersTab() {
    await this.page.getByRole("tab", { name: roleManagementUiLabels.tabUsers }).click();
  }

  async openPropertyAccessTab() {
    await this.page.getByRole("tab", { name: roleManagementUiLabels.tabPropertyAccess }).click();
  }

  async expectRolesBenchmarkVisible() {
    await expect(this.page.getByRole("button", { name: roleManagementUiLabels.addRoleButtonText })).toBeVisible({
      timeout: 25_000,
    });
    await expect(this.page.getByRole("textbox", { name: roleManagementUiLabels.searchBoxName })).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Legacy name: ensures we are on the user-role-management route. */
  async expectRolesTabSelected() {
    await expect(this.page).toHaveURL(/user-role-management/i, { timeout: 15_000 });
  }

  /** User Role Management grid exposes property/location columns (MCP-verified). */
  async expectRolesColumnHeaders() {
    await expect(
      this.page.getByRole("columnheader", { name: roleManagementUiLabels.gridColumnProperties, exact: true }).first(),
    ).toBeVisible({ timeout: 25_000 });
    await expect(
      this.page.getByRole("columnheader", { name: roleManagementUiLabels.gridColumnLocation, exact: true }).first(),
    ).toBeVisible();
  }

  async expectManageTeamBreadcrumb() {
    await expect(
      this.page
        .locator(".mantine-Breadcrumbs-root")
        .getByText(roleManagementUiLabels.breadcrumbUserRoleManagement, { exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
  }
}

module.exports = {
  ManageTeamRolesHelper,
  manageTeamRolesBench: roleManagementUiLabels,
  orgUrls: organizationUrls,
};
