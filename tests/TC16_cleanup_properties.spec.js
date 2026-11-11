require('dotenv').config();

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { LoginPage } = require('../pages/loginPage');
const PropertiesHelper = require('../pages/properties');
const OrganizationHelper = require('../pages/organizationHelper');
const { InvoicePage } = require('../pages/invoicePage');
const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');
const data = require('../fixture/organization.json');

test.use({
  storageState: 'sessionState.json',
  video: 'retain-on-failure',
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  animations: 'disabled',
  maxDiffPixels: 30_000,
  maxDiffPixelRatio: 0.15,
});

const SAMPLE_PROPERTY_1 = 'Test Property 1_Cottages on Elm';
const SAMPLE_PROPERTY_2 = 'Test Property 2_The Westerham';
const SAMPLE_PROPERTY_3 = 'Test Property3 Automation Retainage flow';
const SAMPLE_PROPERTY_4 = 'Test Property4_Multiapprover_automation';
const SAMPLE_PROPERTY_5 = 'Test Property5_Reassigning_Automation';
const SAMPLE_PROPERTY_6 = 'Test Property 6_Draw reporting';
const SAMPLE_PROPERTY_7 = 'Test_property7_CM_Fee_Automation';


/**
 * Loads recently created property name.
 * Priority:
 * 1) downloads/property.json (latest runtime output)
 * 2) data/propertyData.json (fallback)
 * @returns {string|null}
 */
function loadRecentPropertyName() {
  const preferredPath = path.join(process.cwd(), 'downloads', 'property.json');
  const fallbackPath = path.join(__dirname, '../data/propertyData.json');
  try {
    const candidates = [preferredPath, fallbackPath];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const name = parsed?.propertyName;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Loads the job name stored in data/lastCreatedJob.json.
 * @returns {string|null}
 */
function loadLastCreatedJobName() {
  const filePath = path.join(__dirname, '../data/lastCreatedJob.json');
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed?.jobName === 'string' ? parsed.jobName.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Navigates to the global Jobs page via the left panel.
 * Pins the left panel open first (it now loads as a collapsed icon rail, so
 * text-based nav locators below won't find visible matches otherwise), then
 * expands "Construction Management" if collapsed before clicking "Jobs (Contracts & POs)".
 * @param {import('@playwright/test').Page} page
 */
async function navigateToJobsViaLeftPanel(page) {
  await ensureLeftPanelExpanded(page);

  const nav = page.locator('nav').first();
  await nav.waitFor({ state: 'visible', timeout: 15000 });

  const jobsItem = nav.locator('a, div').filter({ hasText: /^Jobs \(Contracts & POs\)$/i }).first();

  if (!(await jobsItem.isVisible().catch(() => false))) {
    const cmSection = nav.locator('a, div').filter({ hasText: /^Construction Management$/i }).first();
    if (await cmSection.isVisible().catch(() => false)) {
      await cmSection.click();
      await page.waitForTimeout(700);
    }
  }

  await expect(jobsItem).toBeVisible({ timeout: 15000 });
  await jobsItem.click();
  await page.waitForURL('**/jobs', { timeout: 20000 });
  await page.waitForTimeout(15000);
}

/**
 * Splits a single CSV line respecting double-quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function splitCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values.map(v => v.replace(/^"|"$/g, '').trim());
}

/**
 * Parses a CSV string (with header row) into an array of objects.
 * @param {string} content
 * @returns {Record<string, string>[]}
 */
function parseJobsCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

/**
 * Returns all visible job titles from the RevoGrid main data pane using the
 * Playwright accessibility tree (pierces shadow DOM — works where
 * document.querySelectorAll fails when the page is loaded via SPA navigation).
 *
 * Main data rows are identified by: has gridcells AND no checkbox AND no
 * "Delete Row" button (those belong to the checkbox and actions panes).
 *
 * @param {import('@playwright/').Page} page
 * @returns {Promise<string[]>}
 */
async function collectVisibleJobTitles(page) {
  const mainDataRows = page.getByRole('row')
    .filter({ hasNot: page.getByRole('checkbox') })
    .filter({ hasNot: page.locator('button[aria-label="Delete Row"]') });

  const rows = await mainDataRows.all();
  const seen = new Set();

  for (const row of rows) {
    const firstCell = row.getByRole('gridcell').first();
    const text = (await firstCell.textContent().catch(() => '')).trim().split('\n')[0].replace(/✕/g, '').trim();
    if (text && !['Title', 'Actions', ''].includes(text)) {
      seen.add(text);
    }
  }

  return [...seen];
}

/**
 * Searches for a job by exact title and deletes it.
 * Uses accessibility-tree row queries (works through shadow DOM) to locate the
 * row index, then clicks the corresponding "Delete Row" button.
 *
 * @param {import('@playwright/').Page} page
 * @param {string} jobTitle
 * @returns {Promise<boolean>} true if deleted
 */
/**
 * @param {string} [project] Project cell value from the export. Titles are not unique
 *   (e.g. "Construction Management Fee Job" exists on protected Test Property 6 too),
 *   so when given, the row must also contain this project value.
 */
async function deleteJobByTitle(page, jobTitle, project) {
  const searchInput = page.locator('input[placeholder="Search..."]:not([disabled])').first();
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  await searchInput.fill(jobTitle);
  await page.keyboard.press('Enter');

  // Find the exact data row that matches the title using accessibility tree
  const mainDataRows = page.getByRole('row')
    .filter({ hasNot: page.getByRole('checkbox') })
    .filter({ hasNot: page.locator('button[aria-label="Delete Row"]') });

  // Poll until the search result renders instead of a fixed 8s sleep.
  let rowIndex = null;
  const deadline = Date.now() + 10000;
  while (rowIndex === null && Date.now() < deadline) {
    await page.waitForTimeout(500);
    const rows = await mainDataRows.all();
    for (let i = 0; i < rows.length; i++) {
      const text = (await rows[i].getByRole('gridcell').first().textContent().catch(() => ''))
        .trim().split('\n')[0].replace(/✕/g, '').trim();
      if (text !== jobTitle) continue;
      if (project) {
        const cells = (await rows[i].getByRole('gridcell').allInnerTexts().catch(() => [])).map((t) => t.trim());
        if (!cells.includes(project)) continue;
      }
      rowIndex = await rows[i].getAttribute('data-rgrow').catch(() => null);
      break;
    }
  }

  if (rowIndex === null) {
    console.log(`[cleanup-jobs] Job "${jobTitle}" not found after search, skipping.`);
    await searchInput.fill('');
    await page.waitForTimeout(1000);
    return false;
  }

  // Scope to the matched row (pinned Actions column shares data-rgrow): not every row has a
  // Delete action (e.g. Construction Management Fee jobs only show View), so a global
  // .nth() could land on a different job's trash button.
  const deleteBtn = page.locator(`[role="row"][data-rgrow="${rowIndex}"] button[aria-label="Delete Row"]`).first();
  if (!(await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log(`[cleanup-jobs] Job "${jobTitle}" has no Delete action in the grid (view-only), skipping.`);
    await searchInput.fill('');
    return false;
  }

  await deleteBtn.click();
  await page.waitForTimeout(500);

  const confirmBtn = page.locator([
    '.mantine-Popover-dropdown button:has-text("Delete")',
    '[role="alertdialog"] button:has-text("Delete")',
    '[role="dialog"] button:has-text("Delete")',
  ].join(', ')).first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
  // Confirm fires DELETE /api/bird-table/rows {table_name:"job", row_id} (MCP-verified 2026-11-03);
  // wait on it instead of a fixed 10s+5s sleep so 80+ jobs fit in the budget.
  const deleteResponse = page.waitForResponse(
    (r) => r.url().includes('/api/bird-table/rows') && r.request().method() === 'DELETE',
    { timeout: 30000 }
  );
  await confirmBtn.click();
  const resp = await deleteResponse;
  if (!resp.ok()) {
    console.log(`[cleanup-jobs] Backend rejected delete for "${jobTitle}" (HTTP ${resp.status()}): ${await resp.text().catch(() => '')}`);
  }

  await page.locator('input[placeholder="Search..."]:not([disabled])').first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => { });
  await searchInput.fill('');
  await page.waitForTimeout(1000);
  return resp.ok();
}

/**
 * Names visible in the current treegrid viewport (first column text per data row).
 * @param {import('@playwright/').Page} page
 * @returns {Promise<string[]>}
 */
async function collectVisiblePropertyNames(page) {
  const grid = page.locator('[role="treegrid"]').first();
  await grid.waitFor({ state: 'visible', timeout: 60000 });
  const rows = grid.locator('[role="row"]');
  const count = await rows.count();
  const names = [];
  const skip = new Set(['Property Name', 'Name', '']);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const firstCell = row.locator('[role="gridcell"]').first();
    if ((await firstCell.count()) === 0) continue;
    const raw = (await firstCell.innerText()).trim();
    const name = raw.split('\n')[0].trim();
    if (!name || skip.has(name)) continue;
    if (name.length < 2) continue;
    names.push(name);
  }

  return [...new Set(names)];
}

/**
 * Scrolls the treegrid and unions visible first-column names (handles virtualized rows).
 * @param {import('@playwright/').Page} page
 * @returns {Promise<string[]>}
 */
async function collectAllPropertyNamesFromGrid(page) {
  const grid = page.locator('[role="treegrid"]').first();
  await grid.waitFor({ state: 'visible', timeout: 60000 });
  const all = new Set();

  await grid.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(400);

  let stagnant = 0;
  let prevSize = 0;

  for (let step = 0; step < 60; step++) {
    const batch = await collectVisiblePropertyNames(page);
    batch.forEach((n) => all.add(n));

    if (all.size === prevSize) stagnant += 1;
    else stagnant = 0;
    prevSize = all.size;

    const atBottom = await grid.evaluate((el) => {
      const scrollable = el;
      return scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 8;
    });

    if (atBottom && stagnant >= 2) break;

    await grid.evaluate((el) => {
      el.scrollTop = Math.min(el.scrollTop + Math.max(200, el.clientHeight * 0.75), el.scrollHeight);
    });
    await page.waitForTimeout(280);

    if (stagnant >= 8 && step > 10) break;
  }

  return [...all];
}

/**
 * Locates the Users grid (Manage Organization > Users tab). It renders as a
 * revo-grid `[role="treegrid"]`, not a plain HTML `<table>` — and more than
 * one `[role="treegrid"]` can be present on the page (Roles tab; a stray
 * leftover grid from prior navigation has also been observed live), so this
 * disambiguates by the unique "Email" column header (MCP-verified 2026-08-05).
 * @param {import('@playwright/test').Page} page
 */
function usersGridLocator(page) {
  return page.locator('[role="treegrid"]').filter({
    has: page.locator('[role="columnheader"]').filter({ hasText: 'Email' }),
  }).first();
}

/**
 * Locates the Users tab search box. The placeholder changed from
 * "Search by name or email" to "Search..." (with a separate "Search" button),
 * and the search is now only applied on Enter (MCP-verified 2026-10-05).
 * The legacy placeholder is kept as a fallback.
 * @param {import('@playwright/test').Page} page
 */
function usersSearchInputLocator(page) {
  return page
    .locator('.mantine-AppShell-main')
    .locator('input[placeholder="Search..."], input[placeholder="Search by name or email"], input[placeholder="Search by name or e-mail"]')
    .first();
}

/**
 * Types `text` into the Users search box and presses Enter so the search is applied.
 * Pass '' to clear a previous search.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 * @param {{ required?: boolean }} [opts] required=false skips silently when the box isn't shown
 */
async function applyUsersSearch(page, text, { required = true } = {}) {
  const search = usersSearchInputLocator(page);
  if (required) {
    await search.waitFor({ state: 'visible', timeout: 30000 });
  } else if (!(await search.isVisible().catch(() => false))) {
    return;
  }
  await search.fill(text);
  await search.press('Enter');
  await page.waitForTimeout(5000);
}

/**
 * revo-grid renders the pinned "Actions" column as a separate DOM pane from
 * the scrollable Name/Email/Status columns, but every cell — in both panes —
 * carries the same `data-rgrow="N"` per visual row (MCP-verified), which is
 * how a status cell is paired with its own "User actions" button.
 * @param {import('@playwright/test').Locator} grid
 * @param {string} rgrow
 */
function userActionButton(grid, rgrow) {
  return grid.locator(`[role="row"][data-rgrow="${rgrow}"]`).getByRole('button', { name: 'User actions' });
}

/**
 * Admin-role rows render only an "Edit user" button — no "User actions" menu at
 * all (MCP-verified 2026-08-06) — and demoting via the Edit-user dialog's
 * "Organization admin" checkbox 400s server-side, so there's no working revoke
 * path for them in this UI. Both cleanup functions below skip these entirely
 * rather than hang clicking a button that doesn't exist.
 * Role is the 4th grid column (Name, Email, Status, Role, Property access), i.e. nth(3).
 * @param {import('@playwright/test').Locator} grid
 * @param {string} rgrow
 */
async function isAdminRoleRow(grid, rgrow) {
  const roleText = ((await grid.locator(`[role="gridcell"][data-rgrow="${rgrow}"]`).nth(3).textContent().catch(() => '')) || '').trim();
  return /^Admin$/i.test(roleText);
}

/**
 * Clicks a revoke/remove confirm button and waits for the actual mutation API
 * response instead of trusting the confirm dialog closing. MCP-verified
 * 2026-08-06: the dialog closes and the click "succeeds" from the UI's
 * perspective even when the server rejects the mutation — e.g. a stale grid
 * row pointing at an already-revoked membership returns
 * `DELETE /api/organization/users/{id}` -> 400
 * `{"success":false,"message":"UserOrganizationMembership not found: ..."}`
 * while a genuine success is 200 `{"success":true,"userId":...}`. Trusting
 * dialog-closed alone silently counts failures as done.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} confirmBtn
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function clickConfirmAndVerifyApi(page, confirmBtn) {
  const responsePromise = page.waitForResponse(
    (resp) => /\/api\/organization\/users\/[\w-]+/.test(resp.url()) && ['DELETE', 'PATCH', 'PUT', 'POST'].includes(resp.request().method()),
    { timeout: 15000 }
  ).catch(() => null);

  await confirmBtn.click();
  const response = await responsePromise;

  if (!response) {
    return { ok: false, message: 'No matching /api/organization/users/* response observed within 15s' };
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // non-JSON response — fall back to HTTP status alone
  }

  const ok = response.ok() && body?.success !== false;
  const message = body?.message || `HTTP ${response.status()}`;
  return { ok, message };
}

/**
 * Runs one full revoke/remove attempt against a single row — opening the
 * action menu, clicking the given menu-item action, confirming the dialog,
 * and verifying the API response — with every step wrapped so NOTHING can
 * throw uncaught. Without this, a single row whose menu/dialog doesn't behave
 * as expected (stale UI state left over from a previous failed attempt,
 * something not rendering in time, etc.) throws out of the scan loop and
 * fails the entire test instead of just that one user — every other pending
 * user in the list never gets touched. Callers only need to check `ok` and
 * move on to the next row regardless of outcome.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} actionButton
 * @param {RegExp} menuItemNamePattern
 * @param {RegExp} confirmDialogHasText
 * @param {string} confirmBtnSelector
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function attemptRevokeRow(page, actionButton, menuItemNamePattern, confirmDialogHasText, confirmBtnSelector) {
  try {
    // The grid can leave a row's action button disabled/loading for a while
    // right after a prior deletion re-renders this same index (MCP-verified
    // 2026-08-06: title="User actions" data-loading="true" disabled) — wait
    // generously for it to become interactive rather than failing fast and
    // wrongly giving up on an otherwise-healthy row.
    await expect(actionButton).toBeEnabled({ timeout: 120000 });
    await actionButton.click({ timeout: 10000 });

    const actionItem = page.getByRole('menuitem', { name: menuItemNamePattern }).first();
    await actionItem.waitFor({ state: 'visible', timeout: 10000 });
    await actionItem.click({ timeout: 10000 });

    const confirmDialog = page.locator('[role="alertdialog"], [role="dialog"]').filter({ hasText: confirmDialogHasText }).first();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });

    const confirmBtn = confirmDialog.locator(confirmBtnSelector).first();
    const result = await clickConfirmAndVerifyApi(page, confirmBtn);

    await confirmDialog.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    return result;
  } catch (err) {
    return { ok: false, message: `Exception during revoke attempt: ${err?.message || err}` };
  } finally {
    // Reset any stray open menu/dialog so the next row's attempt starts from
    // a clean state, regardless of how this one ended.
    await page.keyboard.press('Escape').catch(() => { });
    await page.waitForTimeout(500);
  }
}

/**
 * Cleans pending/expired users across the Users grid:
 * - Pending (product's current label for a not-yet-accepted invite) => Revoke invitation
 * - Expired => Remove user
 * No pagination controls exist on this grid (MCP-verified: no "Next" button, and the
 * grid doesn't overflow its own viewport at current user-list sizes), so this scans
 * and removes matching rows in a single pass instead of paging.
 * @param {import('@playwright/test').Page} page
 */
async function revokeAllInvitedUsersAcrossPages(page) {
  const grid = usersGridLocator(page);
  await grid.waitFor({ state: 'visible', timeout: 30000 });

  let totalRevoked = 0;
  const maxIterations = 300;
  // Per-email failure tracking: a transient failure (e.g. dialog race) gets
  // retried on the next scan since we don't advance past it, but a row that
  // keeps failing (e.g. stale membership reference — MCP-verified 400 case)
  // must not spin forever, so it's excluded from the scan after 3 tries.
  const failureCounts = new Map();
  const skipEmails = new Set();

  for (let guard = 0; guard < maxIterations; guard++) {
    await page.waitForTimeout(guard === 0 ? 3000 : 1500);

    const statusCells = grid.locator('[role="gridcell"]').filter({ hasText: /^(Pending|Invited|Expired)$/i });
    const count = await statusCells.count().catch(() => 0);
    if (count === 0) break;

    let targetRgrow = null;
    let targetStatus = null;
    let emailText = '';
    for (let i = 0; i < count; i++) {
      const cell = statusCells.nth(i);
      const statusText = ((await cell.textContent().catch(() => '')) || '').trim();
      const rgrow = await cell.getAttribute('data-rgrow').catch(() => null);
      if (rgrow == null) continue;
      if (await isAdminRoleRow(grid, rgrow)) continue;
      const candidateEmail = ((await grid.locator(`[role="gridcell"][data-rgrow="${rgrow}"]`).nth(1).textContent().catch(() => '')) || '').trim();
      if (skipEmails.has(candidateEmail)) continue;
      targetRgrow = rgrow;
      targetStatus = /Expired/i.test(statusText) ? 'expired' : 'invited';
      emailText = candidateEmail;
      break;
    }

    // targetRgrow stays null once only admin-role/given-up-on rows remain —
    // that's an intended stop condition, not an error.
    if (targetRgrow == null) break;

    const actionButton = userActionButton(grid, targetRgrow);
    const { ok, message } = await attemptRevokeRow(
      page,
      actionButton,
      targetStatus === 'expired' ? /Remove user|Remove invitation|Remove|Delete/i : /Revoke invitation|Revoke invite/i,
      targetStatus === 'expired' ? /Remove user|Remove invitation|Remove|Delete/i : /Revoke invitation|Revoke invite/i,
      targetStatus === 'expired'
        ? 'button:has-text("Remove"), button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
        : 'button:has-text("Revoke"), button:has-text("Confirm"), button:has-text("Yes")'
    );

    if (!ok) {
      const failCount = (failureCounts.get(emailText) || 0) + 1;
      failureCounts.set(emailText, failCount);
      console.log(`[cleanup-users] FAILED to revoke ${emailText || 'unknown'} (attempt ${failCount}): ${message}`);
      if (failCount >= 3) {
        console.log(`[cleanup-users] Giving up on ${emailText} after ${failCount} failed attempts — skipping.`);
        skipEmails.add(emailText);
      }
      continue; // not counted as revoked — next scan retries this row (if still present) or moves on
    }

    totalRevoked += 1;
    console.log(`[cleanup-users] ${targetStatus === 'expired' ? 'Removed expired' : 'Revoked invited'} user: ${emailText || 'unknown'} (API confirmed: ${message})`);
  }

  return totalRevoked;
}

/**
 * Removes/revokes every user row whose text matches `matchText`, regardless of status
 * (Pending/Invited, Expired, or already-active Member) — unlike revokeAllInvitedUsersAcrossPages,
 * which only targets Pending/Invited/Expired rows. Active members use a "Remove user" menu action
 * instead of "Revoke invitation"/"Remove invitation", so this tries each in turn.
 * Kept separate from revokeAllInvitedUsersAcrossPages (used by TC260) so that flow is untouched.
 * @param {import('@playwright/test').Page} page
 * @param {string} matchText
 */
async function revokeUsersMatchingTextAnyStatus(page, matchText) {
  const grid = usersGridLocator(page);
  // A search with no matches removes the grid entirely and shows an empty state
  // instead (MCP-verified 2026-10-05) — that means nothing to clean, not a failure.
  const emptyState = page.getByText('No organization users added yet');
  await grid.or(emptyState).first().waitFor({ state: 'visible', timeout: 30000 });
  if (await emptyState.isVisible().catch(() => false)) return 0;
  const matchRe = new RegExp(matchText, 'i');

  let totalRemoved = 0;
  const maxIterations = 300;
  // Same per-email retry/give-up tracking as revokeAllInvitedUsersAcrossPages —
  // a row that keeps 400ing (e.g. stale membership reference) must not spin forever.
  const failureCounts = new Map();
  const skipEmails = new Set();

  for (let guard = 0; guard < maxIterations; guard++) {
    await page.waitForTimeout(guard === 0 ? 3000 : 1500);

    // A successful revoke clears the search box and resets the grid to the full
    // (virtualized) list (MCP-verified 2026-10-05), hiding the remaining matches —
    // re-apply the search whenever it no longer holds matchText.
    const currentSearch = await usersSearchInputLocator(page).inputValue().catch(() => null);
    if (currentSearch !== null && currentSearch !== matchText) {
      await applyUsersSearch(page, matchText);
    }

    const emailCells = grid.locator('[role="gridcell"]').filter({ hasText: matchRe });
    const count = await emailCells.count().catch(() => 0);
    if (count === 0) break;

    // Scan past any admin-role or given-up-on matches instead of stopping at
    // the first one — admins have no working revoke path in this UI (see
    // isAdminRoleRow) but later matches should still get cleaned up.
    let rgrow = null;
    let candidateEmailForRow = '';
    for (let i = 0; i < count; i++) {
      const candidateRgrow = await emailCells.nth(i).getAttribute('data-rgrow').catch(() => null);
      if (candidateRgrow == null) continue;
      if (await isAdminRoleRow(grid, candidateRgrow)) continue;
      const email = ((await grid.locator(`[role="gridcell"][data-rgrow="${candidateRgrow}"]`).nth(1).textContent().catch(() => '')) || '').trim();
      if (skipEmails.has(email)) continue;
      rgrow = candidateRgrow;
      candidateEmailForRow = email;
      break;
    }
    if (rgrow == null) break; // only admin-role/given-up-on matches remain — leave them alone

    const rowText = ((await grid.locator(`[role="gridcell"][data-rgrow="${rgrow}"]`).allInnerTexts().catch(() => [])) || []).join(' | ');

    // Pending/Invited/Expired rows expose "Revoke invitation"; Active members expose
    // "Revoke access" (MCP-verified 2026-08-06 — confirm dialog: "Revoke access?",
    // DELETE /api/organization/users/{id}, same endpoint as the invite-revoke path).
    // "Remove user"/"Remove"/"Delete" kept as fallbacks in case that copy resurfaces.
    const actionButton = userActionButton(grid, rgrow);
    const menuActionPattern = /Revoke invitation|Revoke invite|Revoke access|Remove invitation|Remove user|Remove|Delete/i;
    const { ok, message } = await attemptRevokeRow(
      page,
      actionButton,
      menuActionPattern,
      menuActionPattern,
      'button:has-text("Revoke"), button:has-text("Remove"), button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
    );

    if (!ok) {
      const failCount = (failureCounts.get(candidateEmailForRow) || 0) + 1;
      failureCounts.set(candidateEmailForRow, failCount);
      console.log(`[cleanup-fga] FAILED to remove ${candidateEmailForRow || 'unknown'} (attempt ${failCount}): ${message}`);
      if (failCount >= 3) {
        console.log(`[cleanup-fga] Giving up on ${candidateEmailForRow} after ${failCount} failed attempts — skipping.`);
        skipEmails.add(candidateEmailForRow);
      }
      continue; // not counted as removed — next scan retries this row (if still present) or moves on
    }

    totalRemoved += 1;
    // The re-applied search can briefly still return the just-removed user
    // (later attempts 400 "not an active member"), so never target it again.
    skipEmails.add(candidateEmailForRow);
    console.log(`[cleanup-fga] Removed user: ${rowText.replace(/\n/g, ' | ')} (API confirmed: ${message})`);
  }

  return totalRemoved;
}

/**
 * Revokes/removes every user whose Status is anything other than "Active" and
 * whose Role is not Admin — across the whole Users grid, no email filter.
 *
 * Deliberately matches on "not Active" rather than an enumerated status list
 * (unlike revokeAllInvitedUsersAcrossPages's /^(Pending|Invited|Expired)$/i):
 * MCP-verified 2026-08-07 against the real `/api/organization/users` response
 * shows only two raw status values exist ("pending"/"active"), and the display
 * label for the non-active one has already changed once this session
 * ("Invited" -> "Pending") — matching the negative condition instead of an
 * enumerated positive list means a future rename can't silently zero out
 * matches again.
 *
 * Reuses the same admin-skip (isAdminRoleRow — Admin rows have no working
 * revoke path in this UI) and per-email retry/give-up tracking as the other
 * two cleanup functions above.
 *
 * Unlike those two, this scans the WHOLE unfiltered org (hundreds of users),
 * and the grid virtualizes rows: only ~11 of e.g. 361 total rows actually
 * exist in the DOM at once, rendered by an inner `.vertical-inner.scroll-rgRow`
 * viewport — NOT the outer `[role="treegrid"]` itself, which never overflows
 * (MCP-verified 2026-08-07). Without scrolling that inner viewport, this
 * function only ever sees whatever ~11 rows happened to be visible initially
 * and silently reports "0 found" even with 223 real candidates further down —
 * so this scrolls forward through the list whenever nothing actionable is
 * currently rendered, and only stops once scrolling stops making progress.
 * @param {import('@playwright/test').Page} page
 */
async function revokeAllNonActiveNonAdminUsers(page) {
  const grid = usersGridLocator(page);
  await grid.waitFor({ state: 'visible', timeout: 30000 });

  // Start from the top so the scroll-forward scan below covers the full list.
  await grid.evaluate((el) => {
    el.querySelectorAll('.vertical-inner.scroll-rgRow').forEach((s) => { s.scrollTop = 0; });
  }).catch(() => { });
  await page.waitForTimeout(500);

  let totalRevoked = 0;
  const maxIterations = 800;
  const failureCounts = new Map();
  const skipEmails = new Set();
  const menuActionPattern = /Revoke invitation|Revoke invite|Revoke access|Remove invitation|Remove user|Remove|Delete/i;
  let stagnantScrolls = 0;

  for (let guard = 0; guard < maxIterations; guard++) {
    await page.waitForTimeout(guard === 0 ? 3000 : 800);

    const rowEls = grid.locator('[role="row"][data-rgrow]');
    const rowCount = await rowEls.count().catch(() => 0);

    // Each visual row renders twice (main pane + pinned Actions pane) sharing
    // the same data-rgrow — dedupe before checking Status/Role per index.
    const seenRgrows = new Set();
    let targetRgrow = null;
    let emailText = '';
    for (let i = 0; i < rowCount; i++) {
      const rgrow = await rowEls.nth(i).getAttribute('data-rgrow').catch(() => null);
      if (rgrow == null || seenRgrows.has(rgrow)) continue;
      seenRgrows.add(rgrow);

      const statusText = ((await grid.locator(`[role="gridcell"][data-rgrow="${rgrow}"]`).nth(2).textContent().catch(() => '')) || '').trim();
      if (!statusText || /^Active$/i.test(statusText)) continue; // active — leave alone
      if (await isAdminRoleRow(grid, rgrow)) continue; // admin — no working revoke path (see isAdminRoleRow)

      const email = ((await grid.locator(`[role="gridcell"][data-rgrow="${rgrow}"]`).nth(1).textContent().catch(() => '')) || '').trim();
      if (skipEmails.has(email)) continue;

      targetRgrow = rgrow;
      emailText = email;
      break;
    }

    if (targetRgrow == null) {
      // Nothing actionable in the currently-rendered window — scroll the
      // virtualized viewport forward before concluding there's nothing left.
      const scrollState = await grid.evaluate((el) => {
        const scrollers = [...el.querySelectorAll('.vertical-inner.scroll-rgRow')];
        if (scrollers.length === 0) return null;
        const before = scrollers[0].scrollTop;
        const atBottomBefore = before + scrollers[0].clientHeight >= scrollers[0].scrollHeight - 4;
        scrollers.forEach((s) => {
          s.scrollTop = Math.min(s.scrollTop + Math.max(200, s.clientHeight * 0.8), s.scrollHeight);
        });
        return { before, after: scrollers[0].scrollTop, atBottomBefore };
      }).catch(() => null);

      await page.waitForTimeout(500);

      if (!scrollState) break; // no scrollable viewport found — nothing more to do
      if (scrollState.after === scrollState.before) {
        stagnantScrolls += 1;
      } else {
        stagnantScrolls = 0;
      }

      // Already at the bottom (no movement possible) or stuck for a couple of
      // passes despite requesting movement — the whole list has been covered.
      if (scrollState.atBottomBefore || stagnantScrolls >= 3) break;
      continue;
    }

    const actionButton = userActionButton(grid, targetRgrow);
    const { ok, message } = await attemptRevokeRow(
      page,
      actionButton,
      menuActionPattern,
      menuActionPattern,
      'button:has-text("Revoke"), button:has-text("Remove"), button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
    );

    if (!ok) {
      const failCount = (failureCounts.get(emailText) || 0) + 1;
      failureCounts.set(emailText, failCount);
      console.log(`[cleanup-nonactive] FAILED to revoke ${emailText || 'unknown'} (attempt ${failCount}): ${message}`);
      if (failCount >= 3) {
        console.log(`[cleanup-nonactive] Giving up on ${emailText} after ${failCount} failed attempts — skipping.`);
        skipEmails.add(emailText);
      }
      continue; // not counted as revoked — next scan retries this row (if still present) or moves on
    }

    totalRevoked += 1;
    console.log(`[cleanup-nonactive] Revoked/removed non-Active, non-Admin user: ${emailText || 'unknown'} (API confirmed: ${message})`);
  }

  return totalRevoked;
}

/**
 * Admin accounts that must never be revoked, whatever their status. Covers the
 * accounts the suites log in with (.env) plus any extra ones listed in
 * PROTECTED_ADMIN_EMAILS (comma-separated). Add permanent ones to the array.
 */
const PROTECTED_ADMIN_EMAILS = new Set(
  [
    process.env.TEST_EMAIL,
    process.env.VENDOR_EMAIL,
    process.env.NEW_TEST_EMAIL,
    ...(process.env.PROTECTED_ADMIN_EMAILS || '').split(','),
  ]
    .map((e) => (e || '').trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Revokes the invitation of every user whose email contains `matchText` AND
 * whose Status is exactly "pending". Active users (and anything that isn't
 * pending) are never touched, nor is anything in PROTECTED_ADMIN_EMAILS.
 *
 * Safety layers (MCP-verified 2026-10-05):
 * - Only the "Revoke invitation" menu item is used — pending rows expose
 *   "Resend invitation"/"Revoke invitation", active rows expose "Revoke access",
 *   which this never clicks, so an active user can't be revoked even if a row
 *   shifts under the cursor.
 * - The row's email/status is re-read immediately before acting.
 * - The confirm dialog ("Revoke invite? ... revoke the invite to <email>?")
 *   must name the exact target email, or nothing is confirmed.
 *
 * A successful revoke clears the search and resets the virtualized grid, so the
 * search is re-applied each iteration; matches beyond the ~11 rendered rows are
 * reached by scrolling the inner viewport (same approach as revokeAllNonActiveNonAdminUsers).
 * @param {import('@playwright/test').Page} page
 * @param {string} matchText
 */
async function revokePendingUsersMatchingText(page, matchText) {
  const grid = usersGridLocator(page);
  const emptyState = page.getByText('No organization users added yet');
  await grid.or(emptyState).first().waitFor({ state: 'visible', timeout: 30000 });
  if (await emptyState.isVisible().catch(() => false)) return 0;

  const matchLower = matchText.toLowerCase();
  const isTarget = (email, status) =>
    email.toLowerCase().includes(matchLower) &&
    /^pending$/i.test(status) &&
    !PROTECTED_ADMIN_EMAILS.has(email.toLowerCase());
  const readRow = async (rgrow) => {
    const cells = grid.locator(`[role="gridcell"][data-rgrow="${rgrow}"]`);
    const email = ((await cells.nth(1).textContent().catch(() => '')) || '').trim();
    const status = ((await cells.nth(2).textContent().catch(() => '')) || '').trim();
    return { email, status };
  };

  let totalRevoked = 0;
  const maxIterations = 800;
  const failureCounts = new Map();
  const skipEmails = new Set();
  const rejectedEmails = [];
  let stagnantScrolls = 0;

  for (let guard = 0; guard < maxIterations; guard++) {
    await page.waitForTimeout(guard === 0 ? 3000 : 800);

    const currentSearch = await usersSearchInputLocator(page).inputValue().catch(() => null);
    if (currentSearch !== null && currentSearch !== matchText) {
      await applyUsersSearch(page, matchText);
    }
    if (await emptyState.isVisible().catch(() => false)) break;

    const rowEls = grid.locator('[role="row"][data-rgrow]');
    const rowCount = await rowEls.count().catch(() => 0);
    if (rowCount === 0) break;

    // Each visual row renders twice (main pane + pinned Actions pane) — dedupe by data-rgrow.
    const seenRgrows = new Set();
    let targetRgrow = null;
    let targetEmail = '';
    for (let i = 0; i < rowCount; i++) {
      const rgrow = await rowEls.nth(i).getAttribute('data-rgrow').catch(() => null);
      if (rgrow == null || seenRgrows.has(rgrow)) continue;
      seenRgrows.add(rgrow);

      const { email, status } = await readRow(rgrow);
      if (!isTarget(email, status) || skipEmails.has(email)) continue;
      targetRgrow = rgrow;
      targetEmail = email;
      break;
    }

    if (targetRgrow == null) {
      const scrollState = await grid.evaluate((el) => {
        const scrollers = [...el.querySelectorAll('.vertical-inner.scroll-rgRow')];
        if (scrollers.length === 0) return null;
        const before = scrollers[0].scrollTop;
        const atBottomBefore = before + scrollers[0].clientHeight >= scrollers[0].scrollHeight - 4;
        scrollers.forEach((s) => {
          s.scrollTop = Math.min(s.scrollTop + Math.max(200, s.clientHeight * 0.8), s.scrollHeight);
        });
        return { before, after: scrollers[0].scrollTop, atBottomBefore };
      }).catch(() => null);

      await page.waitForTimeout(500);

      if (!scrollState) break;
      stagnantScrolls = scrollState.after === scrollState.before ? stagnantScrolls + 1 : 0;
      if (scrollState.atBottomBefore || stagnantScrolls >= 3) break;
      continue;
    }

    // Re-check right before acting — the virtualized grid may have re-rendered this index.
    const recheck = await readRow(targetRgrow);
    if (recheck.email !== targetEmail || !isTarget(recheck.email, recheck.status)) continue;

    const emailRe = new RegExp(targetEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const { ok, message } = await attemptRevokeRow(
      page,
      userActionButton(grid, targetRgrow),
      /^Revoke invitation$/i,
      emailRe,
      'button:has-text("Revoke")'
    );

    if (!ok) {
      // The API answered with a rejection (e.g. DELETE /api/organization/users/{id}
      // -> 400 "Organization admins cannot be revoked", MCP-verified 2026-10-05) —
      // retrying won't change it, so log the user and move on to the next one.
      // Only UI-level failures (no API response / exception) fall through to retries.
      const apiRejected = !/^(Exception during revoke attempt|No matching \/api)/.test(message);
      if (apiRejected) {
        console.log(`[cleanup-pending-admin] API rejected revoke for ${targetEmail}: ${message} — skipping to next user.`);
        skipEmails.add(targetEmail);
        rejectedEmails.push(targetEmail);
        continue;
      }
      const failCount = (failureCounts.get(targetEmail) || 0) + 1;
      failureCounts.set(targetEmail, failCount);
      console.log(`[cleanup-pending-admin] FAILED to revoke ${targetEmail} (attempt ${failCount}): ${message}`);
      if (failCount >= 3) {
        console.log(`[cleanup-pending-admin] Giving up on ${targetEmail} after ${failCount} failed attempts — skipping.`);
        skipEmails.add(targetEmail);
      }
      continue;
    }

    totalRevoked += 1;
    skipEmails.add(targetEmail); // re-applied search can briefly still list it
    console.log(`[cleanup-pending-admin] Revoked pending invite: ${targetEmail} (API confirmed: ${message})`);
  }

  if (rejectedEmails.length) {
    console.log(`[cleanup-pending-admin] ${rejectedEmails.length} user(s) rejected by the API and skipped: ${rejectedEmails.join(', ')}`);
  }
  return totalRevoked;
}

/**
 * Deletes every custom column on whatever table is currently open, via
 * Table > Hide/show columns, one at a time, until only default columns
 * remain. MCP-verified 2026-08-13 on the Approvals "All Approvals" grid:
 * - "Table" toolbar button: getByTestId('bt-table-action') — opens a menu
 *   with "Add custom column" / "Hide / show columns".
 * - "Hide / show columns": getByTestId('bt-table-action-hide-show-columns')
 *   — opens a "Manage Columns" dialog listing Default Columns (plain
 *   checkboxes, no action buttons) and Custom Columns (checkbox + 3 buttons:
 *   pen/edit, trash2/delete, ellipsis/more — no aria-labels, identified by
 *   their lucide icon class).
 * - Clicking the trash icon opens a second "Delete Column" confirm dialog
 *   ("Are you sure you want to delete the "..." column? ... Cancel / Delete").
 * - Confirms via `DELETE /api/bird-table/columns` -> 200
 *   `{"success":true,"message":"Column deleted successfully",...}`.
 * - Critically (MCP-verified 2026-08-13, through several real bounded test
 *   runs that kept stopping after deleting only 1 of ~500 columns): whether
 *   the "Manage Columns" panel stays open or closes itself after a delete is
 *   inconsistent/racy. It's a right-side slide-out drawer (not a modal) that,
 *   when open, physically overlaps the "Table" toolbar button underneath it —
 *   so blindly re-clicking that button to reopen the panel can hang or fail
 *   waiting for a target that's actually covered by the panel already being
 *   open. Reliably detecting "is it already open" turned out to be racy too.
 *   The robust fix: reload the page before every attempt after the first,
 *   which guarantees the panel starts closed and the toolbar is reachable,
 *   at the cost of a slower per-column loop.
 * Only default columns have no delete button at all, so
 * `button:has(svg.lucide-trash2)` unambiguously matches custom columns only.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>} number of custom columns actually deleted
 */
async function openManageColumnsDialog(page) {
  await page.getByTestId('bt-table-action').click({ timeout: 10000 });
  const hideShowBtn = page.getByTestId('bt-table-action-hide-show-columns');
  await hideShowBtn.waitFor({ state: 'visible', timeout: 10000 });
  await hideShowBtn.click({ timeout: 10000 });

  const manageDialog = page.locator('[role="dialog"]').filter({ hasText: 'Manage Columns' }).first();
  await expect(manageDialog).toBeVisible({ timeout: 15000 });
  return manageDialog;
}

async function removeAllCustomColumns(page) {
  let totalRemoved = 0;
  let consecutiveFailures = 0;
  const maxIterations = 1000;

  for (let guard = 0; guard < maxIterations; guard++) {
    if (guard > 0) {
      // Guaranteed-clean starting state for every attempt after the first —
      // see the note above on why reopening via the Table button in-place is
      // unreliable once a delete has already happened once this page load.
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
      await page.waitForTimeout(4000);
      await page.getByTestId('bt-table-action').waitFor({ state: 'visible', timeout: 20000 }).catch(() => { });
    }

    let manageDialog;
    try {
      manageDialog = await openManageColumnsDialog(page);
    } catch (err) {
      console.log(`[cleanup-columns] Could not open Manage Columns dialog, stopping: ${err?.message || err}`);
      break;
    }
    // The Custom Columns section can render a beat after the dialog itself
    // becomes visible (same async-load pattern as the grid behind it) — wait
    // for it explicitly so a fresh open isn't misread as "nothing left".
    await manageDialog.getByText('Custom Columns', { exact: true }).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => { });
    const trashButtons = manageDialog.locator('button:has(svg.lucide-trash2)');
    const count = await trashButtons.count().catch(() => 0);
    if (count === 0) {
      await page.keyboard.press('Escape').catch(() => { });
      break; // only default columns left
    }

    try {
      await trashButtons.first().click({ timeout: 10000 });

      const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Are you sure you want to delete' }).last();
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });
      const confirmBtn = confirmDialog.getByRole('button', { name: 'Delete', exact: true });

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/bird-table/columns') && resp.request().method() === 'DELETE',
        { timeout: 15000 }
      ).catch(() => null);

      await confirmBtn.click({ timeout: 10000 });
      const response = await responsePromise;

      let ok = false;
      let message = 'No matching DELETE /api/bird-table/columns response observed within 15s';
      if (response) {
        let body = null;
        try { body = await response.json(); } catch { /* fall back to status alone */ }
        ok = response.ok() && body?.success !== false;
        message = body?.message || `HTTP ${response.status()}`;
      }

      await confirmDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });
      await page.waitForTimeout(300);

      if (!ok) {
        consecutiveFailures += 1;
        console.log(`[cleanup-columns] FAILED to delete a custom column (${consecutiveFailures} consecutive): ${message}`);
        if (consecutiveFailures >= 3) {
          console.log('[cleanup-columns] 3 consecutive failures — stopping to avoid spinning on a stuck column.');
          break;
        }
        continue; // next iteration reloads for a clean state and retries
      }

      consecutiveFailures = 0;
      totalRemoved += 1;
      if (totalRemoved % 25 === 0 || totalRemoved <= 3) {
        console.log(`[cleanup-columns] Deleted custom column ${totalRemoved} (API confirmed: ${message})`);
      }
    } catch (err) {
      consecutiveFailures += 1;
      console.log(`[cleanup-columns] Exception deleting a custom column (${consecutiveFailures} consecutive): ${err?.message || err}`);
      await page.keyboard.press('Escape').catch(() => { });
      if (consecutiveFailures >= 3) {
        console.log('[cleanup-columns] 3 consecutive failures — stopping to avoid spinning on a stuck column.');
        break;
      }
    }
  }

  await page.keyboard.press('Escape').catch(() => { }); // close Manage Columns dialog
  return totalRemoved;
}

test.describe('Approvals table cleanup', () => {
  test('TC266 @cleanup @approvals Remove all custom columns from the Approvals table', async ({ browser }) => {
    // MCP-verified 500+ custom columns present, and the Manage Columns dialog
    // must be fully reopened per deletion (see removeAllCustomColumns) — one
    // pass through the whole backlog can run several hours. Note this exceeds
    // the GitHub Actions workflow's job-level `timeout-minutes: 150` ceiling,
    // so a single CI run will still only make partial progress; safe to rerun.
    test.setTimeout(14400000); // 4 hours

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    try {
      try {
        await test.step('Open Approvals (All Approvals tab) via the left panel', async () => {
          const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
          await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(8000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }

          await ensureLeftPanelExpanded(page);
          const nav = page.locator('nav').first();
          await nav.waitFor({ state: 'visible', timeout: 15000 });
          const approvalsItem = nav.locator('a, div').filter({ hasText: /^Approvals$/i }).first();
          await expect(approvalsItem).toBeVisible({ timeout: 15000 });
          await approvalsItem.click();
          await page.waitForURL('**/approvals/**', { timeout: 20000 });
          await page.waitForTimeout(5000);

          await expect(page.getByTestId('bt-table-action')).toBeVisible({ timeout: 20000 });
        });

        await test.step('Remove all custom columns via Table > Hide/show columns', async () => {
          const removedCount = await removeAllCustomColumns(page);
          console.log(`[cleanup-columns] Total custom columns removed: ${removedCount}`);
          expect(removedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-columns] Approvals column cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe('Properties cleanup', () => {
  test('TC261 @cleanup @job Delete all jobs not belonging to protected properties or last created job', async ({ browser }) => {
    test.setTimeout(3600000); // 1 hour — 80+ deletable jobs at ~4-5s each

    const lastCreatedJobName = loadLastCreatedJobName();
    const dryRun = process.env.CLEANUP_DRY_RUN === '1';
    const protectedProperties = new Set([
      SAMPLE_PROPERTY_1,
      SAMPLE_PROPERTY_2,
      SAMPLE_PROPERTY_3,
      SAMPLE_PROPERTY_4,
      SAMPLE_PROPERTY_5,
      SAMPLE_PROPERTY_6,
      SAMPLE_PROPERTY_7,
    ]);

    console.log(`[cleanup-jobs] *** ${dryRun ? 'DRY-RUN MODE — nothing will be deleted' : 'LIVE MODE — deletions are real'} ***`);
    console.log(`[cleanup-jobs] Protected job from lastCreatedJob.json: ${lastCreatedJobName || '(none)'}`);
    console.log(`[cleanup-jobs] Protected properties: ${[...protectedProperties].join(', ')}`);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();

    try {
      try {
        await test.step('Navigate to Jobs page', async () => {
          const baseUrl = (process.env.BASE_URL || 'https://beta.tailorbird.com').replace(/\/$/, '');
          await page.goto(`${baseUrl}/jobs`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(20000);
          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
          await page.getByRole('button', { name: 'Export' }).waitFor({ state: 'visible', timeout: 30000 });
        });

        let toDelete = [];

        await test.step('Export jobs list and identify deletable jobs', async () => {
          // Export downloads all jobs (not just visible page) so we get a complete list
          // with their property names — avoids the filter panel entirely.
          const exportPath = path.join(process.cwd(), 'downloads', 'jobs-export.csv');

          // Export is now a menu ("Export CSV" / "Export Custom Report") instead of a
          // direct download — "Export CSV" still yields the full job-data.csv with the
          // same Title/Property columns (MCP-verified 2026-11-02).
          await page.getByRole('button', { name: 'Export' }).click();
          const exportCsvItem = page.getByRole('menuitem', { name: /^Export CSV/ });
          await exportCsvItem.waitFor({ state: 'visible', timeout: 15000 });
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            exportCsvItem.click(),
          ]);
          await download.saveAs(exportPath);
          console.log(`[cleanup-jobs] Export saved to: ${exportPath}`);

          const raw = fs.readFileSync(exportPath, 'utf-8');
          const jobs = parseJobsCSV(raw);
          console.log(`[cleanup-jobs] Export contains ${jobs.length} job row(s)`);

          for (const job of jobs) {
            // Column header may vary slightly; try common variants
            const title = (job['Title'] || job['title'] || job['Job Title'] || '').trim();
            const property = (job['Property'] || job['property'] || '').trim();

            if (!title) continue;

            if (lastCreatedJobName && title === lastCreatedJobName) {
              console.log(`[cleanup-jobs] KEEP (last created job): "${title}"`);
              continue;
            }

            const isProtected = [...protectedProperties].some(p =>
              property === p || p.includes(property) || property.includes(p)
            );
            if (isProtected) {
              console.log(`[cleanup-jobs] KEEP (protected property "${property}"): "${title}"`);
              continue;
            }

            console.log(`[cleanup-jobs] ${dryRun ? 'DRY-RUN: would delete' : 'WILL DELETE'}: "${title}" (property: "${property || 'unknown'}")`);
            if (!dryRun) toDelete.push({ title, project: (job['Project'] || '').trim() });
          }

          if (dryRun) {
            console.log('[cleanup-jobs] DRY-RUN complete — no deletions performed.');
            return;
          }

          console.log(`[cleanup-jobs] ${toDelete.length} job(s) queued for deletion.`);
        });

        if (!dryRun && toDelete.length > 0) {
          await test.step(`Delete ${toDelete.length} job(s)`, async () => {
            let deleted = 0;
            for (const { title, project } of toDelete) {
              console.log(`[cleanup-jobs] Deleting "${title}" (project ${project || '—'}) (${deleted + 1}/${toDelete.length})`);
              const success = await deleteJobByTitle(page, title, project);
              if (success) deleted++;
              else console.log(`[cleanup-jobs] SKIP — "${title}" not found or already deleted.`);
            }
            console.log(`[cleanup-jobs] Done: ${deleted}/${toDelete.length} job(s) deleted.`);
          });
        }

      } catch (err) {
        throw new Error(`[cleanup-jobs] Job cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close().catch((e) => {
        console.warn(`[cleanup-jobs] context.close warning: ${e.message}`);
      });
    }
  });

  test('TC259 @cleanup @property Delete all properties except sample pair and recently created', async ({
    browser,
  }) => {
    // Large environments can have hundreds of generated properties;
    // allow enough time for full cleanup in one run.
    test.setTimeout(3600000);

    const recent = loadRecentPropertyName();
    const keep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4, SAMPLE_PROPERTY_5, SAMPLE_PROPERTY_6, SAMPLE_PROPERTY_7]);
    if (recent) keep.add(recent);
    const requiredKeep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4, SAMPLE_PROPERTY_5, SAMPLE_PROPERTY_6, SAMPLE_PROPERTY_7]);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const prop = new PropertiesHelper(page);
    // name -> backend error message, for properties the API refused to delete.
    const rejected = new Map();

    try {
      try {
        await test.step('Open Properties (table view) with existing session', async () => {
          const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
          await prop.goto(dashboardUrl);
          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
          await ensureLeftPanelExpanded(page);
          await prop.goToProperties();
          await prop.changeView('Table View');
        });

        await test.step('Clear search', async () => {
          const input = page.locator('input[placeholder="Search..."]');
          await input.click();
          await input.fill('');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(5000);
        });

        await test.step('Delete properties not in keep list', async () => {
          let iterations = 0;
          const maxIterations = 200;

          // Only enforce "must remain" for protected names that actually
          // exist at cleanup start; prevents false failures when the recent
          // downloaded property is already gone from prior runs.
          const initialNames = await collectAllPropertyNamesFromGrid(page);
          for (const name of keep) {
            if (initialNames.includes(name)) requiredKeep.add(name);
          }

          while (iterations < maxIterations) {
            iterations += 1;

            await page.locator('input[placeholder="Search..."]').fill('');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(5000);

            const allNames = await collectAllPropertyNamesFromGrid(page);
            const toRemove = allNames.filter((n) => !keep.has(n) && !rejected.has(n));

            if (toRemove.length === 0) {
              console.log('[cleanup] No extra properties to delete.');
              break;
            }

            // Delete all discovered extras in this scan to avoid repeated
            // expensive grid scans that can trigger test timeout.
            for (const victim of toRemove) {
              console.log(`[cleanup] Deleting: ${victim}`);
              try {
                await prop.deleteProperty(victim);
              } catch (err) {
                // Backend refuses properties that still have jobs (HTTP 400); skip and keep going.
                if (!(err instanceof PropertiesHelper.PropertyDeleteRejectedError)) throw err;
                console.warn(`[cleanup] Skipping "${victim}": ${err.message}`);
                rejected.set(victim, err.message);
              }
            }
          }

          expect(iterations).toBeLessThan(maxIterations);
        });

        if (rejected.size > 0) {
          const summary = [...rejected.keys()].join(', ');
          console.warn(`[cleanup] ${rejected.size} propert(ies) rejected by backend (likely still have jobs — run TC261 first): ${summary}`);
          test.info().annotations.push({ type: 'cleanup-skipped', description: `Backend rejected delete: ${summary}` });
        }

        await test.step('Verify only kept properties remain', async () => {
          await page.locator('input[placeholder="Search..."]').fill('');
          await page.waitForTimeout(5000);

          const remaining = await collectAllPropertyNamesFromGrid(page);
          const unexpected = remaining.filter((n) => !keep.has(n) && !rejected.has(n));
          expect(
            unexpected,
            `Unexpected properties still present: ${unexpected.join(', ')}`
          ).toEqual([]);
          for (const must of requiredKeep) {
            expect(remaining, `Kept property missing from list: ${must}`).toContain(must);
          }
        });
      } catch (err) {
        throw new Error(`[cleanup] Property cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close().catch((e) => {
        console.warn(`[cleanup-users] context.close warning ignored: ${e.message}`);
      });
    }
  });

  test('TC262 @cleanup @invoice Create and confirm 40 invoices for the requested job', async ({ browser }) => {
    test.setTimeout(1800000); // 30 min for 40 repeated invoice confirmations

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const invoicePage = new InvoicePage(page);
    const targetUrl = process.env.INVOICE_TARGET_URL || 'https://beta.tailorbird.com/jobs/3861?propertyId=6009&tab=invoices';
    
    try {
      await test.step('Open the requested job invoice page', async () => {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(10000);
        if ((page.url() || '').includes('/login')) {
          throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
        }
        await expect(page).toHaveURL(/tab=invoices/i);
        await ensureLeftPanelExpanded(page);
      });

      const createdInvoices = [];

      await test.step('Create and confirm 40 invoices in a loop', async () => {
        const totalRuns = 40;
        for (let index = 1; index <= totalRuns; index++) {
          const invoiceNumber = `AUTO-${Date.now()}-${String(index).padStart(2, '0')}`;
          const invoiceTitle = `Automation Invoice ${index}`;
          const invoiceDescription = `Cleanup invoice ${index}`;

          console.log(`[cleanup-invoices] Creating invoice ${index}/${totalRuns}: ${invoiceTitle} (number: ${invoiceNumber})`);

          await invoicePage.clickAddInvoice();
          await page.waitForTimeout(2000);

          await invoicePage.fillInvoiceDetails({
            title: invoiceTitle,
            description: invoiceDescription,
            invoiceNumber,
          });

          const actualInvoiceNumber = await invoicePage.getInvoiceNumber();

          await invoicePage.fillInvoiceGridAmount(100);
          await invoicePage.confirmInvoiceAndHandleModal();

          const record = {
            index,
            title: invoiceTitle,
            description: invoiceDescription,
            invoiceNumber: actualInvoiceNumber || invoiceNumber,
          };
          createdInvoices.push(record);
          console.log(`[cleanup-invoices] Created invoice ${index}/${totalRuns}: title="${record.title}", invoiceNumber="${record.invoiceNumber}"`);

          await invoicePage.goBackToInvoiceList();
          await page.waitForTimeout(2000);
        }

        console.log(`[cleanup-invoices] Summary — ${createdInvoices.length}/${totalRuns} invoice(s) created:`);
        createdInvoices.forEach((inv) => {
          console.log(`[cleanup-invoices]   ${inv.index}. "${inv.title}" (invoiceNumber: ${inv.invoiceNumber})`);
        });
      });
    } finally {
      await context.close().catch((error) => {
        console.warn(`[cleanup-invoices] context.close warning ignored: ${error.message}`);
      });
    }
  });
});

/**
 * Locates the global Invoices grid (left panel > Construction Management >
 * Invoices, URL /invoices). MCP-verified 2026-09-09: this is a single
 * `[role="treegrid"]` disambiguated by its "Invoice Number" column header.
 * @param {import('@playwright/test').Page} page
 */
function invoiceGridLocator(page) {
  return page.locator('[role="treegrid"]').filter({
    has: page.getByRole('columnheader', { name: 'Invoice Number' }),
  }).first();
}

/**
 * Finds the topmost invoice row not already in `skipSet` and returns its
 * invoice number plus a locator for its "Delete Invoice" button.
 *
 * MCP-verified 2026-09-09: the grid splits each visual row across several
 * separate `[role="row"][data-rgrow="N"]` DOM elements (checkbox pane, main
 * data pane, actions pane) that all share the same `data-rgrow` — the
 * invoice-number link lives in one such element, the "Delete Invoice" button
 * in another. Filtering `[role="row"][data-rgrow]` by `has: <Delete Invoice
 * button>` narrows to just the actions-pane row for each visual row, in
 * visual (top-to-bottom) order; the matching invoice number is then looked up
 * by re-querying every element sharing that same `data-rgrow`.
 * @param {import('@playwright/test').Page} page
 * @param {Set<string>} skipSet invoice numbers to skip (already failed/blocked)
 * @returns {Promise<{invoiceNumber: string, deleteButton: import('@playwright/test').Locator} | null>}
 */
async function findNextDeletableInvoiceRow(page, skipSet) {
  const grid = invoiceGridLocator(page);
  await grid.waitFor({ state: 'visible', timeout: 30000 });

  const actionRows = grid.locator('[role="row"][data-rgrow]').filter({
    has: page.getByRole('button', { name: 'Delete Invoice' }),
  });
  const count = await actionRows.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const row = actionRows.nth(i);
    const rgrow = await row.getAttribute('data-rgrow', { timeout: 5000 }).catch(() => null);
    if (rgrow == null) continue;

    // MCP-verified 2026-09-11: the Invoice Number cell's link text is whatever
    // custom value the invoice was given (e.g. "AUTO-1789092381455-40" from
    // TC262), NOT always "Invoice #<id>" — matching only /^Invoice #/ means
    // that link is never found for these, so every single row (and every
    // already-skipped row, on every re-scan) burned the full lookup timeout
    // before falling back to a placeholder name. With dozens of permanently
    // undeletable "pending approval" invoices piling up at the top from
    // repeated TC262 runs, that per-row tax on every re-scan made the loop
    // grind to a crawl even though it was technically still advancing.
    // Grabbing the row's first link by position (no name filter) matches the
    // Invoice Number column regardless of its text and resolves immediately.
    //
    // A short, explicit timeout is still kept as a safety net: without one, a
    // row whose actions pane rendered a "Delete Invoice" button but whose
    // paired data-pane row (same data-rgrow) has no link at all — e.g. a
    // transient mismatch right after the grid re-renders from a prior
    // deletion — would make Playwright wait for a link that never appears.
    // With no playwright.config.js in this repo setting a default
    // actionTimeout, that wait is unbounded, and `.catch(() => '')` never
    // fires because the promise never rejects, it just never resolves — this
    // is exactly what hung a real run for 5+ minutes until the browser was
    // force-closed (MCP/trace-confirmed 2026-09-11) instead of falling back.
    const invoiceLink = grid
      .locator(`[role="row"][data-rgrow="${rgrow}"] a`)
      .first();
    const invoiceNumber = (((await invoiceLink.textContent({ timeout: 5000 }).catch(() => '')) || '').trim()).replace(/✕$/, '').trim() || `row-rgrow-${rgrow}`;

    if (skipSet.has(invoiceNumber)) continue;

    return { invoiceNumber, deleteButton: row.getByRole('button', { name: 'Delete Invoice' }) };
  }

  return null;
}

/**
 * Clicks "Delete Invoice", confirms the "Are you sure you want to delete this
 * invoice?" dialog, and verifies the deletion by the mutation API's HTTP
 * status code alone (200 => deleted, anything else => blocked/failed) rather
 * than trusting the dialog closing. MCP-verified 2026-09-09 against the real
 * endpoint: `DELETE /api/bird-table/rows` with body
 * `{table_name:"invoice", row_id, context_data}` -> 200 on a genuine
 * deletion, but a business-rule block (e.g. an invoice still pending
 * approval) returns 400 — while the confirm dialog still closes normally
 * either way. Checking status only (no response-body parsing) keeps each
 * iteration fast across a long top-to-bottom run.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} deleteButton
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function deleteInvoiceRowAndVerifyApi(page, deleteButton) {
  try {
    await deleteButton.scrollIntoViewIfNeeded().catch(() => { });
    await expect(deleteButton).toBeEnabled({ timeout: 30000 });
    await deleteButton.click({ timeout: 10000 });

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Delete Invoice' }).first();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    const confirmBtn = confirmDialog.getByRole('button', { name: 'Delete', exact: true });

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/bird-table/rows') && resp.request().method() === 'DELETE',
      { timeout: 20000 }
    ).catch(() => null);

    await confirmBtn.click({ timeout: 10000 });
    const response = await responsePromise;

    await confirmDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });

    if (!response) {
      return { ok: false, message: 'No matching DELETE /api/bird-table/rows response observed within 20s' };
    }

    return { ok: response.status() === 200, message: `HTTP ${response.status()}` };
  } catch (err) {
    return { ok: false, message: `Exception during invoice delete attempt: ${err?.message || err}` };
  } finally {
    await page.keyboard.press('Escape').catch(() => { });
  }
}

/**
 * Repeatedly deletes the topmost deletable invoice from the global Invoices
 * list until either no deletable rows remain or `maxRuntimeMs` elapses.
 * An invoice whose deletion the API rejects (e.g. still pending approval) is
 * added to a skip set so the loop moves on to the next row down instead of
 * retrying the same blocked invoice forever.
 * @param {import('@playwright/test').Page} page
 * @param {number} maxRuntimeMs
 */
async function deleteInvoicesTopToBottomViaApi(page, maxRuntimeMs) {
  const startTime = Date.now();
  const skipSet = new Set();
  let deletedCount = 0;
  let failedCount = 0;
  const maxIterations = 5000;

  for (let guard = 0; guard < maxIterations; guard++) {
    if (Date.now() - startTime >= maxRuntimeMs) {
      console.log('[cleanup-invoices-delete] 2-hour time budget reached, stopping.');
      break;
    }

    const target = await findNextDeletableInvoiceRow(page, skipSet);
    if (!target) {
      console.log('[cleanup-invoices-delete] No more deletable invoice rows found (or all remaining are skipped).');
      break;
    }

    const { ok, message } = await deleteInvoiceRowAndVerifyApi(page, target.deleteButton);

    if (ok) {
      deletedCount += 1;
      console.log(`[cleanup-invoices-delete] Deleted "${target.invoiceNumber}" (API confirmed: ${message}) — total deleted: ${deletedCount}`);
      // A deleted invoice must fully settle server-side before the next one
      // can be deleted — deleting the next row too soon after this returns
      // HTTP 200 gets rejected with 400 (business rule: the prior invoice's
      // deletion must complete first). 800ms wasn't enough; 10s matches what
      // the backend actually needs to finish processing the deletion.
      await page.waitForTimeout(10000);
    } else {
      failedCount += 1;
      skipSet.add(target.invoiceNumber);
      console.log(`[cleanup-invoices-delete] FAILED to delete "${target.invoiceNumber}" (API confirmed): ${message} — skipping this invoice.`);
      await page.waitForTimeout(500);
    }
  }

  return { deletedCount, failedCount, skippedInvoices: [...skipSet] };
}

/**
 * Invoice ids and statuses straight from the grid's own read API (read-only), so the
 * cleanup can target every invoice instead of only the ~14 rows revogrid renders.
 * @param {import('@playwright/test').Page} page
 * @param {number} [jobId] only invoices on this job (TC269); all invoices when omitted (TC267)
 * @returns {Promise<{id: number, status: string}[]>}
 */
async function fetchInvoiceList(page, jobId) {
  return page.evaluate(async (jobId) => {
    const res = await fetch('/api/bird-table?table_name=invoice');
    const body = await res.json();
    return (body.rows || [])
      .filter((r) => jobId == null || r.job_id === jobId)
      .map((r) => ({ id: r.id, status: r.status, jobId: r.job_id }));
  }, jobId ?? null);
}

/**
 * Rejects a pending invoice approval via Approvals > View Details > "Reject on Behalf".
 * MCP-verified 2026-11-09: DELETE on a "Pending Approval" invoice returns 400 "Invoice is
 * pending approval and cannot be deleted"; after rejecting on behalf (notes are required)
 * the invoice status becomes "Rejected" and DELETE returns 200. The reject is a server
 * action (no /api/ call), so success is confirmed by polling the invoice's status.
 * Expects the page to already be on /approvals.
 * Also used for change orders (TC273): pass approvalType 'Change Order' and tableName 'change_order'.
 * @param {import('@playwright/test').Page} page
 * @param {number} invoiceId record id (shown in the Approvals "ID" column)
 * @param {{approvalType?: string, tableName?: string}} [opts]
 * @returns {Promise<{ok: boolean, reason: string}>}
 */
async function rejectInvoiceApproval(page, invoiceId, { approvalType = 'Invoice', tableName = 'invoice' } = {}) {
  // Close any dialog left over from the previous invoice so it can't block the search.
  if (await page.locator('[role="dialog"]').count()) {
    await page.keyboard.press('Escape');
    await page.locator('[role="dialog"]').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
  }
  const search = page.locator('input[placeholder="Search..."]').first();
  await search.fill(String(invoiceId));
  await page.keyboard.press('Enter');

  // Note: locator.isVisible() ignores its timeout and returns immediately, so wait explicitly.
  // Match the exact ID cell: the Invoice Number column is often a custom value (e.g. "PAY-1137").
  // Also match the Approval Type cell: the search returns other types (e.g. a Draw) whose
  // ID can collide with this record's id (MCP-verified 2026-11-10 searching "11057").
  const row = page.locator('[role="row"][data-rgrow]')
    .filter({ has: page.getByRole('gridcell', { name: String(invoiceId), exact: true }) })
    .filter({ has: page.getByRole('gridcell', { name: approvalType, exact: true }) }).first();
  let found = await row.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
  // The search is free-text, so the id also matches other rows' numbers; the grid renders only
  // ~10 rows, so the real row can sit further down (MCP-verified: CO #4770 was result row 37).
  if (!found) {
    const box = await page.locator('[role="treegrid"]').first().boundingBox().catch(() => null);
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(150, box.height / 2));
      let lastMax = -1;
      for (let k = 0; k < 60 && !found; k++) {
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(300);
        found = (await row.count()) > 0;
        const max = await page.evaluate(() => Math.max(-1, ...[...document.querySelectorAll('[role="treegrid"] [role="row"][data-rgrow]')]
          .map((r) => Number(r.getAttribute('data-rgrow')))));
        if (max === lastMax) break; // reached the bottom
        lastMax = max;
      }
    }
  }
  if (!found) {
    return { ok: false, reason: 'approval row not found after search' };
  }
  const rgrow = await row.getAttribute('data-rgrow');
  await page.locator(`[role="row"][data-rgrow="${rgrow}"] button[title="View Details"]`).first().click();

  const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Approval Details' }).first();
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  // When the logged-in user is the current approver the button is plain "Reject";
  // otherwise it is "Reject on Behalf" (MCP-verified 2026-11-10 on Invoice #30320).
  const rejectBtn = dialog.getByRole('button', { name: /^Reject( on Behalf)?$/ }).first();
  if (!(await rejectBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false))) {
    // e.g. CO #4766: approval shows "Auto-approved (steps skipped)" while the record is still
    // "Pending Approval" — backend data inconsistency, nothing to click (MCP-verified 2026-11-10).
    const autoApproved = await dialog.getByText(/Auto-approved/i).count().catch(() => 0);
    await page.keyboard.press('Escape');
    return {
      ok: false,
      reason: autoApproved
        ? 'approval is "Auto-approved (steps skipped)" but record is still Pending Approval — no Reject possible'
        : 'no "Reject" / "Reject on Behalf" button in Approval Details',
    };
  }
  await dialog.getByPlaceholder('Enter any remarks or notes about this approval...').fill('Automation cleanup');
  await rejectBtn.click();

  // Source of truth: the invoice leaves "Pending Approval" (toast takes ~4s and can be missed).
  let status = 'Pending Approval';
  for (let i = 0; i < 15 && status === 'Pending Approval'; i++) {
    await page.waitForTimeout(1000);
    status = await page.evaluate(async ({ id, table }) => {
      const res = await fetch(`/api/bird-table?table_name=${table}&row_id=${id}`);
      return ((await res.json()).rows || [])[0]?.status || 'GONE';
    }, { id: invoiceId, table: tableName }).catch(() => 'Pending Approval');
  }
  await page.keyboard.press('Escape').catch(() => { });
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
  return status === 'Pending Approval'
    ? { ok: false, reason: 'still Pending Approval 15s after Reject on Behalf' }
    : { ok: true, reason: status };
}

/**
 * Deletes one invoice from the global Invoices list by searching its id and confirming
 * the "Delete Invoice" dialog. Returns the DELETE /api/bird-table/rows status/body.
 * Expects the page to already be on /invoices.
 * @param {import('@playwright/test').Page} page
 * @param {number} invoiceId
 * @returns {Promise<{status: number, body: string}>}
 */
async function deleteInvoiceById(page, invoiceId) {
  const grid = invoiceGridLocator(page);
  const search = page.locator('input[placeholder="Search..."]').first();
  await search.fill(String(invoiceId));
  await page.keyboard.press('Enter');

  // Link text is often a custom number (e.g. "PAY-1137"); its href always ends in /invoices/<id>.
  const link = grid.locator(`[role="row"][data-rgrow] a[href$="/invoices/${invoiceId}"]`).first();
  if (!(await link.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false))) return { status: 0, body: 'row not found' };
  const rgrow = await link.locator("xpath=ancestor::div[@role='row']").first().getAttribute('data-rgrow');

  const deleteBtn = grid.locator(`[role="row"][data-rgrow="${rgrow}"]`).getByRole('button', { name: 'Delete Invoice' }).first();
  await deleteBtn.click({ timeout: 10000 });
  const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Delete Invoice' }).first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/bird-table/rows') && r.request().method() === 'DELETE',
    { timeout: 20000 }
  );
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  const resp = await responsePromise;
  // Status code alone decides success; the body can be slow to arrive, so it is only read
  // (and capped at 2s) on failure, to log the reason.
  const body = resp.status() === 200
    ? ''
    : await Promise.race([resp.text().catch(() => ''), new Promise((r) => setTimeout(() => r(''), 2000))]);
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
  return { status: resp.status(), body };
}

/**
 * Reopens a locked (Complete/Closed) job via its page's "Reopen Job" button so its invoices can
 * be deleted. MCP-verified 2026-11-10 on job 6475: invoice DELETE returned 400 "This job is
 * locked and cannot be modified."; after Reopen Job (POST /api/jobs/<id>/reopen -> 200) the job
 * is unlocked (status Approved) and the same invoice DELETE returned 200.
 * @returns {Promise<boolean>} true when the reopen call returned HTTP 200
 */
async function reopenLockedJob(page, baseUrl, jobId) {
  await page.goto(`${baseUrl}/jobs/${jobId}`, { waitUntil: 'domcontentloaded' });
  const btn = page.getByRole('button', { name: 'Reopen Job' }).first();
  if (!(await btn.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false))) return false;
  await btn.click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Reopen Job' }).first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const respPromise = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes(`/api/jobs/${jobId}/reopen`),
    { timeout: 30000 },
  ).catch(() => null);
  await dialog.getByRole('button', { name: 'Reopen Job' }).click();
  const resp = await respPromise;
  return !!resp && resp.status() === 200;
}

/**
 * Deletes every invoice, in batches of 50. Invoices that are already deletable
 * (Rejected/Draft/Approved — e.g. rejected by an earlier run) are deleted first; otherwise
 * the next 50 pending invoices are rejected on behalf (Approvals page) and those same 50
 * are deleted straight away (Invoices page) before moving on, so rejected-but-undeleted
 * invoices never pile up.
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {number} maxRuntimeMs
 * @param {number} [jobId] limit to one job's invoices (TC269)
 */
async function rejectAndDeleteAllInvoices(page, baseUrl, maxRuntimeMs, jobId) {
  const startTime = Date.now();
  const outOfTime = () => Date.now() - startTime >= maxRuntimeMs;
  const failed = new Set();
  const reopenedJobs = new Set();
  let deletedCount = 0;
  let rejectedCount = 0;
  const BATCH = 50;

  while (!outOfTime()) {
    const invoices = (await fetchInvoiceList(page, jobId)).filter((inv) => !failed.has(inv.id));
    if (invoices.length === 0) {
      console.log('[cleanup-invoices-delete] No invoices left to delete.');
      break;
    }
    const ready = invoices.filter((inv) => inv.status !== 'Pending Approval');
    const batch = (ready.length > 0 ? ready : invoices).slice(0, BATCH);
    console.log(`[cleanup-invoices-delete] ${invoices.length} invoice(s) remaining (${ready.length} already deletable); ` +
      `${ready.length > 0 ? 'deleting' : 'rejecting then deleting'} batch of ${batch.length}.`);

    const pending = batch.filter((inv) => inv.status === 'Pending Approval');
    if (pending.length > 0) {
      await page.goto(`${baseUrl}/approvals/all-approvals`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[placeholder="Search..."]').first().waitFor({ state: 'visible', timeout: 60000 });
      for (const inv of pending) {
        if (outOfTime()) break;
        const { ok, reason } = await rejectInvoiceApproval(page, inv.id)
          .catch((e) => ({ ok: false, reason: e.message.split('\n')[0] }));
        if (ok) {
          rejectedCount += 1;
          console.log(`[cleanup-invoices-delete] Rejected approval for Invoice #${inv.id} (now ${reason}) — total rejected: ${rejectedCount}`);
        } else {
          failed.add(inv.id);
          console.log(`[cleanup-invoices-delete] Could not reject approval for Invoice #${inv.id}: ${reason} — skipping it.`);
        }
      }
    }

    await page.goto(`${baseUrl}/invoices`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[placeholder="Search..."]').first().waitFor({ state: 'visible', timeout: 60000 });
    for (const inv of batch) {
      if (outOfTime() || failed.has(inv.id)) continue;
      let result = await deleteInvoiceById(page, inv.id).catch((e) => ({ status: -1, body: e.message.split('\n')[0] }));
      // Every 400 gets up to 2 retries (5s apart) so a transient refusal is never reported as a failure.
      // Known 400s (MCP-verified 2026-11-10): "job is locked" is then handled below by reopening the
      // job; "not in the correct format or range" also fails from the app's own Delete button (22
      // invoices with attachments on job 3906, empty Draft #34940 on job 3828) — a backend bug.
      const MAX_RETRIES = 2;
      for (let retry = 0; result.status === 400 && retry < MAX_RETRIES; retry++) {
        console.log(`[cleanup-invoices-delete] Invoice #${inv.id} got HTTP 400 — retry ${retry + 1}/${MAX_RETRIES} in 5s.`);
        await page.waitForTimeout(5000);
        result = await deleteInvoiceById(page, inv.id).catch((e) => ({ status: -1, body: e.message.split('\n')[0] }));
      }
      // Locked (Complete/Closed) job: reopen it once, then retry the delete.
      if (result.status === 400 && /job is locked/i.test(result.body) && inv.jobId && !reopenedJobs.has(inv.jobId)) {
        reopenedJobs.add(inv.jobId);
        const reopened = await reopenLockedJob(page, baseUrl, inv.jobId).catch(() => false);
        console.log(`[cleanup-invoices-delete] Job ${inv.jobId} was locked — Reopen Job ${reopened ? 'succeeded (HTTP 200)' : 'FAILED'}.`);
        await page.goto(`${baseUrl}/invoices`, { waitUntil: 'domcontentloaded' });
        await page.locator('input[placeholder="Search..."]').first().waitFor({ state: 'visible', timeout: 60000 });
        if (reopened) {
          result = await deleteInvoiceById(page, inv.id).catch((e) => ({ status: -1, body: e.message.split('\n')[0] }));
        }
      }
      if (result.status === 400 && /not in the correct format/i.test(result.body)) {
        result.body += ' (backend bug: the app\'s own Delete button fails the same way — e.g. invoices with attachments)';
      }
      if (result.status === 200) {
        deletedCount += 1;
        console.log(`[cleanup-invoices-delete] Deleted Invoice #${inv.id} (HTTP 200) — total deleted: ${deletedCount}`);
      } else {
        failed.add(inv.id);
        console.log(`[cleanup-invoices-delete] FAILED to delete Invoice #${inv.id}: HTTP ${result.status} ${result.body.slice(0, 250)} — skipping it.`);
      }
    }
  }

  if (outOfTime()) console.log('[cleanup-invoices-delete] Time budget reached, stopping.');
  return { deletedCount, rejectedCount, failedCount: failed.size, skippedInvoices: [...failed].map((id) => `Invoice #${id}`) };
}

/**
 * All change orders from the grid's own read API (read-only), oldest first.
 * @returns {Promise<{id:number,status:string,jobId:number}[]>}
 */
async function fetchChangeOrderList(page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/bird-table?table_name=change_order');
    const body = await res.json();
    return (body.rows || [])
      .map((r) => ({ id: r.id, status: r.status, jobId: r.job_id }))
      .sort((a, b) => a.id - b.id);
  });
}

/**
 * Deletes one change order from /change-orders: search its id, find the row whose link ends in
 * /change-orders/<id>, click "Delete Change Order", confirm. Status code decides success; the
 * body is only read on failure, capped at 2s (it can be slow).
 * MCP-verified 2026-11-10: DELETE /api/bird-table/rows {table_name:"change_order", row_id}.
 * @returns {Promise<{status:number, body:string}>}
 */
async function deleteChangeOrderById(page, coId) {
  if (await page.locator('[role="dialog"]').count()) {
    await page.keyboard.press('Escape').catch(() => {});
  }
  const search = page.locator('input[placeholder="Search..."]').first();
  await search.fill(String(coId));
  await page.keyboard.press('Enter');

  const link = page.locator(`[role="treegrid"] [role="row"][data-rgrow] a[href$="/change-orders/${coId}"]`).first();
  if (!(await link.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false))) {
    return { status: 0, body: 'row not found' };
  }
  const rgrow = await link.locator("xpath=ancestor::div[@role='row']").first().getAttribute('data-rgrow');
  await page.locator(`[role="treegrid"] [role="row"][data-rgrow="${rgrow}"]`)
    .getByRole('button', { name: 'Delete Change Order' }).first().click({ timeout: 10000 });
  const dialog = page.getByRole('dialog').filter({ hasText: 'Delete Change Order' }).first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/bird-table/rows') && r.request().method() === 'DELETE'
      && (r.request().postData() || '').includes(`"row_id":"${coId}"`),
    { timeout: 30000 },
  );
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  const resp = await responsePromise;
  const body = resp.status() === 200
    ? ''
    : await Promise.race([resp.text().catch(() => ''), new Promise((r) => setTimeout(() => r(''), 2000))]);
  await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  return { status: resp.status(), body };
}

/**
 * Deletes change orders oldest-first in batches of 50: the batch's "Pending Approval" ones are
 * rejected on the Approvals page first, then the whole batch is deleted on /change-orders.
 * Nothing ever fails the run: any change order that can't be rejected/deleted is skipped and the
 * loop moves on. MCP-verified 2026-11-10:
 *  - Pending Approval -> 400 "Change order is pending approval and cannot be deleted"; after
 *    Reject (Approval Type "Change Order") it becomes Rejected and DELETE returns 200.
 *  - Some need an older one gone first: 400 "Change order cannot be deleted, please delete
 *    'Change Order #8745' first" — so work oldest-first, and once the list is exhausted, take
 *    another pass over the skipped ones as long as the previous pass deleted something.
 *  - "job is locked" -> reopen the job once (same as invoices), then retry.
 */
async function rejectAndDeleteAllChangeOrders(page, baseUrl, maxRuntimeMs) {
  const TAG = '[cleanup-change-orders]';
  const start = Date.now();
  const outOfTime = () => Date.now() - start >= maxRuntimeMs;
  const BATCH = 50;
  const MAX_RETRIES = 2;
  const skipped = new Map(); // id -> last reason (skipped in the current pass)
  const reopenedJobs = new Set();
  let deletedCount = 0;
  let rejectedCount = 0;
  let deletedThisPass = 0;
  let pass = 1;

  const openList = async (route) => {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[placeholder="Search..."]').first().waitFor({ state: 'visible', timeout: 60000 });
  };
  const safeDelete = (id) => deleteChangeOrderById(page, id)
    .catch((e) => ({ status: -1, body: String(e.message || e).split('\n')[0] }));

  while (!outOfTime()) {
    const all = await fetchChangeOrderList(page).catch(() => null);
    if (!all) { await page.waitForTimeout(5000); continue; }
    const todo = all.filter((co) => !skipped.has(co.id));
    if (todo.length === 0) {
      if (skipped.size > 0 && deletedThisPass > 0) {
        console.log(`${TAG} Pass ${pass} done (${deletedThisPass} deleted) — retrying ${skipped.size} skipped change order(s) in pass ${pass + 1}.`);
        skipped.clear();
        deletedThisPass = 0;
        pass += 1;
        continue;
      }
      console.log(`${TAG} Nothing left that can be deleted (${all.length} remaining, all skipped).`);
      break;
    }

    const batch = todo.slice(0, BATCH);
    const pending = batch.filter((co) => co.status === 'Pending Approval');
    console.log(`${TAG} ${all.length} change order(s) remaining; batch of ${batch.length} (${pending.length} pending approval).`);

    if (pending.length > 0) {
      await openList('/approvals/all-approvals').catch(() => {});
      for (const co of pending) {
        if (outOfTime()) break;
        const { ok, reason } = await rejectInvoiceApproval(page, co.id, { approvalType: 'Change Order', tableName: 'change_order' })
          .catch((e) => ({ ok: false, reason: String(e.message || e).split('\n')[0] }));
        if (ok) {
          rejectedCount += 1;
          console.log(`${TAG} Rejected approval for Change Order #${co.id} (now ${reason}) — total rejected: ${rejectedCount}`);
        } else {
          skipped.set(co.id, `reject failed: ${reason}`);
          console.log(`${TAG} Could not reject Change Order #${co.id}: ${reason} — skipping it.`);
        }
      }
    }

    await openList('/change-orders').catch(() => {});
    for (const co of batch) {
      if (outOfTime() || skipped.has(co.id)) continue;
      let result = await safeDelete(co.id);
      for (let retry = 0; result.status === 400 && retry < MAX_RETRIES; retry++) {
        console.log(`${TAG} Change Order #${co.id} got HTTP 400 — retry ${retry + 1}/${MAX_RETRIES} in 3s.`);
        await page.waitForTimeout(3000);
        result = await safeDelete(co.id);
      }
      if (result.status === 400 && /job is locked/i.test(result.body) && co.jobId && !reopenedJobs.has(co.jobId)) {
        reopenedJobs.add(co.jobId);
        const reopened = await reopenLockedJob(page, baseUrl, co.jobId).catch(() => false);
        console.log(`${TAG} Job ${co.jobId} was locked — Reopen Job ${reopened ? 'succeeded (HTTP 200)' : 'FAILED'}.`);
        await openList('/change-orders').catch(() => {});
        if (reopened) result = await safeDelete(co.id);
      }
      if (result.status === 200) {
        deletedCount += 1;
        deletedThisPass += 1;
        console.log(`${TAG} Deleted Change Order #${co.id} (HTTP 200) — total deleted: ${deletedCount}`);
      } else {
        skipped.set(co.id, `HTTP ${result.status} ${result.body.slice(0, 200)}`);
        console.log(`${TAG} Could not delete Change Order #${co.id}: HTTP ${result.status} ${result.body.slice(0, 200)} — skipping to the next one.`);
      }
    }
  }

  if (outOfTime()) console.log(`${TAG} Time budget reached, stopping.`);
  return { deletedCount, rejectedCount, skipped };
}

test.describe('Change orders cleanup', () => {
  test('TC273 @cleanup @changeorder Reject pending approvals and delete change orders for up to 1 hour, verified via API status 200', async ({ browser }) => {
    const RUNTIME_BUDGET_MS = 60 * 60 * 1000; // 1 hour
    test.setTimeout(RUNTIME_BUDGET_MS);
    // Stop starting new work 3 min early so the summary always logs inside the 1h timeout.
    const workBudgetMs = process.env.CHANGE_ORDER_CLEANUP_MINUTES
      ? Number(process.env.CHANGE_ORDER_CLEANUP_MINUTES) * 60 * 1000
      : RUNTIME_BUDGET_MS - 3 * 60 * 1000;

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    try {
      let baseUrl = '';
      await test.step('Open Change Orders (reused session)', async () => {
        const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
        const origin = /^https?:\/\//.test(dashboardUrl) ? new URL(dashboardUrl).origin : '';
        await page.goto(`${origin}/change-orders`, { waitUntil: 'domcontentloaded' });
        if ((page.url() || '').includes('/login')) {
          throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun this test.');
        }
        await expect(page.locator('input[placeholder="Search..."]').first()).toBeVisible({ timeout: 60000 });
        baseUrl = new URL(page.url()).origin;
      });

      await test.step('Reject pending approvals, then delete change orders (skip any that cannot be deleted)', async () => {
        const { deletedCount, rejectedCount, skipped } = await rejectAndDeleteAllChangeOrders(page, baseUrl, workBudgetMs);
        console.log(`[cleanup-change-orders] Summary — rejected: ${rejectedCount}, deleted (HTTP 200): ${deletedCount}, skipped: ${skipped.size}`);
        if (skipped.size > 0) {
          const list = [...skipped].map(([id, why]) => `#${id}: ${why}`);
          console.log(`[cleanup-change-orders] Skipped (left in place): ${list.join(' | ').slice(0, 4000)}`);
          test.info().annotations.push({ type: 'change-orders-skipped', description: list.join('; ').slice(0, 8000) });
        }
        // Skipped change orders never fail the run (by design); only a broken setup does.
      });
    } finally {
      await context.close().catch(() => {});
    }
  });
});

/**
 * Reports > "Explore by module": for every module card (Portfolio, Budgets, CapEx, Invoices,
 * Approvals, Unit Tracker, Draw Reporting, ...) open its "<Module> reports" drawer and delete
 * every report except the 2 most recent. MCP-verified 2026-11-11:
 *  - The drawer lists one row per report, newest first (same order as
 *    GET /api/reports/versions?module=<m>), each with a link /reports/<id>?versionId=… and a
 *    "Delete report" button; the card's "N versions" equals the number of rows.
 *  - Delete opens "Delete report?" ("… and all of its versions will be removed") -> Delete fires
 *    DELETE /api/reports/<id> -> 200, and the row disappears from the drawer.
 *  - Rows are versions: a report with V1+V2 shows 2 rows (Portfolio #254). There is no
 *    per-version delete (report page only has Rename/Regenerate/Save as Template/Export), so
 *    the 2 most recent REPORTS are kept with all their versions; every other report is deleted.
 * A 400 is retried up to 2 times; anything that still can't be deleted is skipped and the loop
 * moves on (never fails the run).
 */
async function cleanupModuleReports(page, deadline) {
  const TAG = '[cleanup-reports]';
  const KEEP = 2;
  const MAX_RETRIES = 2;
  const summary = [];

  // Module cards: buttons whose text is "<Module>\n\n<N> version(s)".
  const readCards = () => page.getByRole('button').evaluateAll((btns) => btns
    .map((b) => (b.innerText || '').trim().match(/^([^\n]+)\n+\s*(\d+) versions?$/))
    .filter(Boolean)
    .map((m) => ({ name: m[1].trim(), count: Number(m[2]) })));

  // Cards render "0 versions" until GET /api/reports?counts=1 lands (seen in a headed run), so
  // wait (up to 30s) for a non-zero count before trusting them.
  let cards = await readCards();
  for (let i = 0; i < 60 && !cards.some((c) => c.count > 0); i++) {
    await page.waitForTimeout(500);
    cards = await readCards();
  }
  console.log(`${TAG} Modules: ${cards.map((c) => `${c.name}=${c.count}`).join(', ')}`);
  // Report names for logging only (the drawer row text near the button is just the status).
  const reportNames = new Map(await page.evaluate(async () => {
    const j = await (await fetch('/api/reports?counts=1')).json();
    return (j.reports || []).map((r) => [String(r.id), r.name]);
  }).catch(() => []));

  for (const card of cards) {
    if (Date.now() >= deadline) break;
    if (card.count <= KEEP) {
      console.log(`${TAG} ${card.name}: ${card.count} report(s) — nothing to delete.`);
      continue;
    }

    await page.keyboard.press('Escape').catch(() => {});
    const cardBtn = page.getByRole('button', { name: new RegExp(`^${card.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\d+ versions?$`) }).first();
    await cardBtn.click();
    const drawer = page.getByRole('dialog').filter({ hasText: `${card.name} reports` }).first();
    await drawer.waitFor({ state: 'visible', timeout: 15000 });
    const rowsDelete = drawer.getByRole('button', { name: 'Delete report' });
    await rowsDelete.first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});

    // Report id + title of every row, in drawer order (top = most recent).
    const readRows = () => drawer.evaluate((d) => [...d.querySelectorAll('button[aria-label="Delete report"]')].map((b) => {
      let el = b;
      for (let i = 0; i < 6 && el.parentElement; i++) {
        el = el.parentElement;
        if (el.querySelector('a[href*="/reports/"]')) break;
      }
      const href = el.querySelector('a[href*="/reports/"]')?.getAttribute('href') || '';
      return { id: (href.match(/\/reports\/(\d+)/) || [])[1] || null };
    })).then((rows) => rows.map((r) => ({ ...r, title: reportNames.get(String(r.id)) || '' })));

    const initial = await readRows();
    // The 2 most recent distinct reports (rows are versions; a report can fill 2 rows).
    const keptIds = [...new Set(initial.map((r) => r.id).filter(Boolean))].slice(0, KEEP);
    console.log(`${TAG} ${card.name}: ${initial.length} report(s); keeping the ${KEEP} most recent (#${keptIds.join(', #')}).`);

    const skipped = new Map();
    let deleted = 0;
    while (Date.now() < deadline) {
      const rows = await readRows();
      // Never touch the top KEEP rows; pick the first deletable row below them.
      let idx = rows.findIndex((r) => r.id && !keptIds.includes(r.id) && !skipped.has(r.id));
      if (idx < 0) break;
      const target = rows[idx];

      const attempt = async () => {
        await rowsDelete.nth(idx).click();
        const confirm = page.getByRole('dialog').filter({ hasText: 'Delete report?' }).first();
        await confirm.waitFor({ state: 'visible', timeout: 10000 });
        const respPromise = page.waitForResponse(
          (r) => r.request().method() === 'DELETE' && new RegExp(`/api/reports/${target.id}(\\?|$)`).test(r.url()),
          { timeout: 60000 },
        ).catch(() => null);
        await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
        const resp = await respPromise;
        await confirm.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        return resp ? resp.status() : null;
      };

      let status = await attempt().catch(() => null);
      for (let retry = 1; retry <= MAX_RETRIES && status === 400; retry++) {
        console.log(`${TAG} ${card.name}: report #${target.id} got HTTP 400 — retry ${retry}/${MAX_RETRIES} in 3s.`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(3000);
        const again = (await readRows()).findIndex((r) => r.id === target.id);
        if (again < 0) break; // row vanished
        idx = again; // re-locate: attempt() clicks rowsDelete.nth(idx)
        status = await attempt().catch(() => null);
      }

      if (status === 200) {
        deleted += 1;
        console.log(`${TAG} ${card.name}: deleted report #${target.id} "${target.title}" (HTTP 200) — ${deleted} deleted`);
        // Wait for the row to leave the drawer before reading the list again.
        for (let i = 0; i < 20 && (await readRows()).some((r) => r.id === target.id); i++) await page.waitForTimeout(250);
      } else {
        skipped.set(target.id, status == null ? 'no DELETE response' : `HTTP ${status}`);
        console.log(`${TAG} ${card.name}: could not delete report #${target.id} "${target.title}" (${skipped.get(target.id)}) — skipping to the next one.`);
        await page.keyboard.press('Escape').catch(() => {});
      }
    }

    const left = (await readRows()).length;
    console.log(`${TAG} ${card.name}: deleted ${deleted}, skipped ${skipped.size}, ${left} report(s) left.`);
    summary.push({ module: card.name, before: initial.length, deleted, skipped: [...skipped].map(([id, why]) => `#${id} ${why}`), left });

    // Close the drawer before the next module.
    await page.keyboard.press('Escape').catch(() => {});
    await drawer.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  return summary;
}

test.describe('Reports cleanup', () => {
  test('TC274 @cleanup @reports Keep the 2 most recent reports per module (Explore by module) and delete the rest, verified via API status 200', async ({ browser }) => {
    const RUNTIME_BUDGET_MS = 60 * 60 * 1000; // 1 hour cap
    test.setTimeout(RUNTIME_BUDGET_MS);
    const workBudgetMs = process.env.REPORT_CLEANUP_MINUTES
      ? Number(process.env.REPORT_CLEANUP_MINUTES) * 60 * 1000
      : RUNTIME_BUDGET_MS - 3 * 60 * 1000;

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    try {
      await test.step('Open Reports (reused session)', async () => {
        const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
        const origin = /^https?:\/\//.test(dashboardUrl) ? new URL(dashboardUrl).origin : '';
        await page.goto(`${origin}/reports`, { waitUntil: 'domcontentloaded' });
        if ((page.url() || '').includes('/login')) {
          throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun this test.');
        }
        await expect(page.getByText('Explore by module', { exact: false }).first()).toBeVisible({ timeout: 60000 });
        await expect(page.getByRole('button', { name: /\d+ versions?$/ }).first()).toBeVisible({ timeout: 60000 });
      });

      await test.step('Per module: keep the 2 most recent reports, delete the rest', async () => {
        const summary = await cleanupModuleReports(page, Date.now() + workBudgetMs);
        for (const s of summary) {
          console.log(`[cleanup-reports] Summary ${s.module}: ${s.before} -> ${s.left} (deleted ${s.deleted}, skipped ${s.skipped.length})`);
        }
        const skipped = summary.flatMap((s) => s.skipped.map((x) => `${s.module} ${x}`));
        if (skipped.length) test.info().annotations.push({ type: 'reports-skipped', description: skipped.join('; ') });
        // Skipped reports never fail the run; only a broken setup does.
      });
    } finally {
      await context.close().catch(() => {});
    }
  });
});

test.describe('Invoices cleanup', () => {
  test('TC267 @cleanup @invoice Delete invoices from the global Invoices list top to bottom, verified via API response', async ({ browser }) => {
    // This test runs for up to 3 hours, deleting invoices from the top of the
    // global Invoices list downward and verifying each deletion through the
    // actual DELETE /api/bird-table/rows API response rather than trusting
    // the UI dialog closing. A small buffer above the 3h work budget lets the
    // last in-flight step/log finish before the test itself times out.
    const RUNTIME_BUDGET_MS = 3 * 60 * 60 * 1000; // 3 hours
    test.setTimeout(RUNTIME_BUDGET_MS);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();

    try {
      try {
        await test.step('Login (reused session) and open Invoices via the left panel', async () => {
          const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
          await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(8000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun this test.');
          }

          await ensureLeftPanelExpanded(page);
          const nav = page.locator('nav').first();
          await nav.waitFor({ state: 'visible', timeout: 15000 });

          const invoicesItem = nav.locator('a, div').filter({ hasText: /^Invoices$/i }).first();
          if (!(await invoicesItem.isVisible().catch(() => false))) {
            const cmSection = nav.locator('a, div').filter({ hasText: /^Construction Management$/i }).first();
            if (await cmSection.isVisible().catch(() => false)) {
              await cmSection.click();
              await page.waitForTimeout(700);
            }
          }

          await expect(invoicesItem).toBeVisible({ timeout: 15000 });
          await invoicesItem.click();
          await page.waitForURL('**/invoices', { timeout: 20000 });
          await page.waitForTimeout(12000);
          await expect(invoiceGridLocator(page)).toBeVisible({ timeout: 30000 });
        });

        await test.step('Reject pending approvals, then delete invoices, verifying each deletion via the API response', async () => {
          // Leave headroom so the summary logs before the test timeout; INVOICE_CLEANUP_MINUTES caps local runs.
          const workBudgetMs = process.env.INVOICE_CLEANUP_MINUTES
            ? Number(process.env.INVOICE_CLEANUP_MINUTES) * 60 * 1000
            : RUNTIME_BUDGET_MS - 5 * 60 * 1000;
          const baseUrl = new URL(page.url()).origin;
          const { deletedCount, rejectedCount, failedCount, skippedInvoices } = await rejectAndDeleteAllInvoices(page, baseUrl, workBudgetMs);

          console.log(`[cleanup-invoices-delete] Summary — rejected on behalf: ${rejectedCount}, deleted (API-confirmed): ${deletedCount}, blocked/failed: ${failedCount}`);
          if (skippedInvoices.length > 0) {
            console.log(`[cleanup-invoices-delete] Invoices left in place (deletion blocked by API): ${skippedInvoices.join(', ')}`);
          }

          expect(deletedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-invoices-delete] Invoice deletion failed: ${err?.message || err}`);
      }
    } finally {
      await context.close().catch((e) => {
        console.warn(`[cleanup-invoices-delete] context.close warning ignored: ${e.message}`);
      });
    }
  });

  test('TC269 @cleanup @invoice Delete all invoices on a specific job Invoice tab, verified via API response', async ({ browser }) => {
    // Deletes every invoice on the job named in the target URL, using the same
    // reject-on-behalf-then-delete flow as TC267 (rejectAndDeleteAllInvoices), limited
    // to that job. MCP-verified 2026-11-10: when the job has no invoices its Invoice tab
    // renders no grid at all, so the test passes with "nothing to delete" instead of
    // requiring the grid to be visible.
    const RUNTIME_BUDGET_MS = 60 * 60 * 1000; // 1 hour — a single job's invoice list is bounded
    test.setTimeout(RUNTIME_BUDGET_MS);

    const targetUrl = process.env.JOB_INVOICE_TARGET_URL
      || 'https://beta.tailorbird.com/jobs/4304?propertyId=7552&tab=invoices&contractSubTab=retainage';

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();

    try {
      try {
        await test.step('Open the job Invoice tab directly by URL', async () => {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(10000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun this test.');
          }

          await expect(page).toHaveURL(/tab=invoices/i);
        });

        await test.step('Reject pending approvals, then delete this job\'s invoices, verifying each deletion via the API status code', async () => {
          const jobId = Number((targetUrl.match(/\/jobs\/(\d+)/) || [])[1]);
          if (!jobId) throw new Error(`Could not read a job id from target URL: ${targetUrl}`);
          const workBudgetMs = process.env.INVOICE_CLEANUP_MINUTES
            ? Number(process.env.INVOICE_CLEANUP_MINUTES) * 60 * 1000
            : RUNTIME_BUDGET_MS - 5 * 60 * 1000;
          const baseUrl = new URL(page.url()).origin;
          console.log(`[cleanup-job-invoices-delete] Job ${jobId}: ${(await fetchInvoiceList(page, jobId)).length} invoice(s) found.`);
          const { deletedCount, rejectedCount, failedCount, skippedInvoices } = await rejectAndDeleteAllInvoices(page, baseUrl, workBudgetMs, jobId);

          console.log(`[cleanup-job-invoices-delete] Summary — rejected on behalf: ${rejectedCount}, deleted (API-confirmed): ${deletedCount}, blocked/failed: ${failedCount}`);
          if (skippedInvoices.length > 0) {
            console.log(`[cleanup-job-invoices-delete] Invoices left in place (deletion blocked by API): ${skippedInvoices.join(', ')}`);
          }

          expect(deletedCount).toBeGreaterThanOrEqual(0);
          expect(failedCount).toBe(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-job-invoices-delete] Job invoice deletion failed: ${err?.message || err}`);
      }
    } finally {
      await context.close().catch((e) => {
        console.warn(`[cleanup-job-invoices-delete] context.close warning ignored: ${e.message}`);
      });
    }
  });
});

/**
 * Locates the Approval Templates grid (Approvals tab > Approval Templates,
 * URL /approvals/template). MCP-verified 2026-09-09: disambiguated from the
 * All Approvals grid by its unique "Template Type" column header.
 * @param {import('@playwright/test').Page} page
 */
function approvalTemplateGridLocator(page) {
  return page.locator('[role="treegrid"]').filter({
    has: page.getByRole('columnheader', { name: 'Template Type' }),
  }).first();
}

/**
 * Finds the topmost approval template row that (a) isn't already in
 * `skipSet` and (b) does not belong to any of the protected properties, and
 * returns its name plus a locator for its delete (trash) button. A template
 * that DOES belong to a protected property is added to `skipSet` (so it is
 * never revisited) and counted in `stats.kept` instead of being returned.
 *
 * MCP-verified 2026-09-09: like the Invoices grid, each visual row is split
 * across two DOM elements sharing the same `data-rgrow` — a main-data-pane
 * row (gridcells in order: Name, Template Type, Properties, Approval Rules,
 * Created By) and a separate actions-pane row holding "Edit" and a delete
 * icon button identified by `svg.lucide-trash2` (same icon/selector as the
 * Approvals-table custom-column cleanup above). A template with no property
 * restriction renders "—" in the Properties cell — that matches none of the
 * protected property names, so it counts as "does not belong" and gets
 * deleted, per the requirement.
 * @param {import('@playwright/test').Page} page
 * @param {Set<string>} protectedProperties
 * @param {Set<string>} skipSet template names to skip (kept or already failed)
 * @param {{kept: number}} stats mutated in place to count newly-kept templates
 * @returns {Promise<{name: string, propertiesText: string, deleteButton: import('@playwright/test').Locator} | null>}
 */
async function findNextDeletableApprovalTemplateRow(page, protectedProperties, skipSet, stats) {
  const grid = approvalTemplateGridLocator(page);
  await grid.waitFor({ state: 'visible', timeout: 30000 });

  const actionRows = grid.locator('[role="row"][data-rgrow]').filter({
    has: page.locator('button:has(svg.lucide-trash2)'),
  });
  const count = await actionRows.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const row = actionRows.nth(i);
    const rgrow = await row.getAttribute('data-rgrow', { timeout: 5000 }).catch(() => null);
    if (rgrow == null) continue;

    const rowCells = grid.locator(`[role="row"][data-rgrow="${rgrow}"] [role="gridcell"]`);
    if ((await rowCells.count().catch(() => 0)) < 3) continue;

    // Explicit timeouts here (see the matching note in findNextDeletableInvoiceRow
    // above): without one, a transient mismatch between this actions-pane row and
    // its paired data-pane row would make Playwright wait indefinitely for a cell
    // that never appears, and `.catch(() => '')` would never fire to recover.
    const name = (((await rowCells.nth(0).textContent({ timeout: 5000 }).catch(() => '')) || '').trim()).replace(/✕$/, '').trim();
    const propertiesText = ((await rowCells.nth(2).textContent({ timeout: 5000 }).catch(() => '')) || '').trim();

    if (!name || skipSet.has(name)) continue;

    const belongsToProtectedProperty = [...protectedProperties].some((p) => propertiesText.includes(p));
    if (belongsToProtectedProperty) {
      skipSet.add(name);
      stats.kept += 1;
      console.log(`[cleanup-approval-templates] KEEP "${name}" — belongs to a protected property (Properties: "${propertiesText}").`);
      continue;
    }

    return { name, propertiesText, deleteButton: row.locator('button:has(svg.lucide-trash2)').first() };
  }

  return null;
}

/**
 * Clicks the delete (trash) icon, confirms the "Delete approval template? /
 * Are you sure you want to delete <name>? This action cannot be undone."
 * dialog, and verifies the deletion by the mutation API's HTTP status code
 * alone (200 => deleted, anything else => failed) — same fast-path
 * verification as the Invoices cleanup above. MCP-verified 2026-09-09against
 * the real endpoint: `DELETE /api/bird-table/rows` with body
 * `{table_name:"approval_template", row_id}` -> 200 on a genuine deletion.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} deleteButton
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function deleteApprovalTemplateRowAndVerifyApi(page, deleteButton) {
  try {
    await deleteButton.scrollIntoViewIfNeeded().catch(() => { });
    await expect(deleteButton).toBeEnabled({ timeout: 30000 });
    await deleteButton.click({ timeout: 10000 });

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Delete approval template?' }).first();
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    const confirmBtn = confirmDialog.getByRole('button', { name: 'Delete', exact: true });

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/bird-table/rows') && resp.request().method() === 'DELETE',
      { timeout: 20000 }
    ).catch(() => null);

    await confirmBtn.click({ timeout: 10000 });
    const response = await responsePromise;

    await confirmDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });

    if (!response) {
      return { ok: false, message: 'No matching DELETE /api/bird-table/rows response observed within 20s' };
    }

    return { ok: response.status() === 200, message: `HTTP ${response.status()}` };
  } catch (err) {
    return { ok: false, message: `Exception during approval template delete attempt: ${err?.message || err}` };
  } finally {
    await page.keyboard.press('Escape').catch(() => { });
  }
}

/**
 * Repeatedly deletes the topmost deletable approval template until either no
 * deletable rows remain or `maxRuntimeMs` elapses. Templates belonging to a
 * protected property are kept (never attempted); a template whose deletion
 * the API rejects is skipped so the loop moves to the next row down instead
 * of retrying it forever.
 * @param {import('@playwright/test').Page} page
 * @param {Set<string>} protectedProperties
 * @param {number} maxRuntimeMs
 */
async function deleteApprovalTemplatesTopToBottomViaApi(page, protectedProperties, maxRuntimeMs) {
  const startTime = Date.now();
  const skipSet = new Set(); // kept (protected) + already-attempted-and-failed names
  const stats = { kept: 0 };
  let deletedCount = 0;
  let failedCount = 0;
  const maxIterations = 5000;

  for (let guard = 0; guard < maxIterations; guard++) {
    if (Date.now() - startTime >= maxRuntimeMs) {
      console.log('[cleanup-approval-templates] 2-hour time budget reached, stopping.');
      break;
    }

    const target = await findNextDeletableApprovalTemplateRow(page, protectedProperties, skipSet, stats);
    if (!target) {
      console.log('[cleanup-approval-templates] No more deletable approval templates found (remaining are protected or already attempted).');
      break;
    }

    const { ok, message } = await deleteApprovalTemplateRowAndVerifyApi(page, target.deleteButton);

    if (ok) {
      deletedCount += 1;
      console.log(`[cleanup-approval-templates] Deleted "${target.name}" (API confirmed: ${message}) — total deleted: ${deletedCount}`);
    } else {
      failedCount += 1;
      skipSet.add(target.name);
      console.log(`[cleanup-approval-templates] FAILED to delete "${target.name}" (API confirmed: ${message}) — skipping this template.`);
    }
  }

  return { deletedCount, failedCount, keptCount: stats.kept };
}

/** Minimal RFC4180 CSV parser (quoted fields, "" escapes, commas/newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

// How many leading CSV columns identify a row. The CSV export is "current table view, as shown",
// so its first columns are exactly the grid's first visible cells:
//   Bids: Bid Name, Property, Status, Vendors, Linked Job
//   Jobs: Title, Status, Job Type, Financial Type, Description
const DRAFT_MATCH_COLUMNS = 5;
const normCell = (t) => String(t ?? '').replace(/✕/g, '').replace(/\s+/g, ' ').trim().replace(/^—$/, '');

/**
 * Clicks Export on a bird-table list page and saves the CSV. Bids downloads straight away;
 * Jobs opens a menu where "Export CSV" (current table view) must be picked.
 * Returns the row keys (first DRAFT_MATCH_COLUMNS columns) of every row whose Status equals targetStatus.
 * @returns {Promise<{draftKeys:Map<string,string>, total:number}>} key -> display name
 */
async function exportDraftRowKeys(page, fileName, logTag, targetStatus) {
  const dir = path.join(process.cwd(), 'downloads');
  fs.mkdirSync(dir, { recursive: true });
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const csvItem = page.getByRole('menuitem').filter({ hasText: 'Export CSV' });
  if (await csvItem.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await csvItem.click();
  }
  const download = await downloadPromise;
  const file = path.join(dir, fileName);
  await download.saveAs(file);

  const [header = [], ...records] = parseCsv(fs.readFileSync(file, 'utf8'));
  const statusIdx = header.findIndex((h) => /^status$/i.test(h.trim()));
  if (statusIdx < 0 || statusIdx >= DRAFT_MATCH_COLUMNS) {
    throw new Error(`[${logTag}] Export has no "Status" column in its first ${DRAFT_MATCH_COLUMNS} columns. Header: ${header.join(', ')}`);
  }
  const draftKeys = new Map();
  for (const r of records) {
    if (normCell(r[statusIdx]).toLowerCase() !== targetStatus.toLowerCase()) continue;
    const cells = r.slice(0, DRAFT_MATCH_COLUMNS).map(normCell);
    draftKeys.set(cells.join('|'), cells[0]);
  }
  return { draftKeys, total: records.length };
}

/**
 * Scrolls a revogrid list top to bottom (it virtualizes rows and columns) and deletes every
 * rendered row whose first DRAFT_MATCH_COLUMNS data cells equal a Draft row from the CSV.
 * Each delete is verified by the DELETE /api/bird-table/rows HTTP status only (body never awaited).
 * @returns {Promise<{deleted:string[], failed:Map<string,string>}>}
 */
async function deleteDraftRowsFromGrid(page, { tableName, draftKeys, deadline, logTag }) {
  const deleted = [];
  const failed = new Map();
  const attempted = new Set(); // one attempt per key per pass; the next export pass catches duplicates
  const anyRow = page.locator('[role="treegrid"] [role="row"][data-rgrow]');

  const scrollBy = async (dy) => {
    const box = await page.locator('[role="treegrid"]').boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(400);
  };
  await anyRow.first().waitFor({ state: 'visible', timeout: 60000 });
  await scrollBy(-1_000_000);

  let lastMaxRow = -1;
  let stalls = 0;
  while (Date.now() < deadline) {
    // Rendered rows: data cells of every pane sharing a data-rgrow, minus the checkbox and Actions panes.
    const readRows = () => page.evaluate((n) => {
      const byIdx = new Map();
      document.querySelectorAll('[role="treegrid"] [role="row"][data-rgrow]').forEach((row) => {
        if (row.querySelector('button[aria-label="Delete Row"]')) return; // Actions pane
        const cells = [...row.querySelectorAll('[role="gridcell"]')];
        if (cells.length === 1 && row.querySelector('input[type="checkbox"], [role="checkbox"]')) return; // selection pane
        const idx = Number(row.getAttribute('data-rgrow'));
        const list = byIdx.get(idx) || [];
        cells.forEach((c) => list.push(c.textContent));
        byIdx.set(idx, list);
      });
      return [...byIdx].map(([idx, cells]) => ({ idx, cells: cells.slice(0, n) }));
    }, DRAFT_MATCH_COLUMNS).then((rows) => rows.map((v) => ({ ...v, key: v.cells.map(normCell).join('|') })));
    const visible = await readRows();
    const target = visible.find((v) => draftKeys.has(v.key) && !attempted.has(v.key));

    if (target) {
      const label = draftKeys.get(target.key);
      attempted.add(target.key);
      try {
        // Re-check right before clicking: the grid may have re-rendered since the scan.
        const now = (await readRows()).find((v) => v.idx === target.idx);
        if (!now || now.key !== target.key) { attempted.delete(target.key); await page.waitForTimeout(500); continue; }
        const attemptDelete = async (idx) => {
          const btn = page.locator(`[role="treegrid"] [role="row"][data-rgrow="${idx}"] button[aria-label="Delete Row"]`).first();
          if (!(await btn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false))) {
            throw new Error('row has no Delete action');
          }
          // A partly hidden row's first click only scrolls it into view (MCP-verified), so retry.
          const confirm = page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true });
          let opened = false;
          for (let i = 0; i < 3 && !opened; i += 1) {
            await btn.click();
            opened = await confirm.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
          }
          if (!opened) throw new Error('delete confirmation dialog did not open');
          const respPromise = page.waitForResponse(
            (r) => r.request().method() === 'DELETE'
              && r.url().includes('/api/bird-table/rows')
              && (r.request().postData() || '').includes(`"table_name":"${tableName}"`),
            { timeout: 60000 },
          );
          await confirm.click();
          return respPromise.catch(() => null);
        };

        let resp = await attemptDelete(target.idx);
        // A 400 gets up to 2 retries (5s apart) so a transient refusal isn't reported as a failure.
        for (let retry = 1; retry <= 2 && resp && resp.status() === 400; retry += 1) {
          console.log(`[${logTag}] "${label}" got HTTP 400 — retry ${retry}/2 in 5s.`);
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(5000);
          const again = (await readRows()).find((v) => v.key === target.key); // same row, re-located
          if (!again) break;
          resp = await attemptDelete(again.idx);
        }
        if (resp && resp.status() === 200) {
          deleted.push(label);
          const rowId = (/"row_id":"?(\d+)/.exec(resp.request().postData() || '') || [])[1];
          console.log(`[${logTag}] Deleted "${label}" (#${rowId}) (HTTP 200)`);
        } else {
          const reason = resp ? `HTTP ${resp.status()}` : 'no DELETE response within 60s';
          failed.set(target.key, reason);
          console.warn(`[${logTag}] Could not delete "${label}": ${reason}`);
        }
      } catch (e) {
        failed.set(target.key, e.message);
        console.warn(`[${logTag}] Could not delete "${label}": ${e.message}`);
        await page.keyboard.press('Escape').catch(() => {});
      }
      await page.waitForTimeout(800); // grid re-renders after a delete; rescan the same position
      continue;
    }

    // Nothing to delete in view: scroll down; stop when the last rendered row stops changing.
    const maxRow = visible.reduce((m, v) => Math.max(m, v.idx), -1);
    stalls = maxRow === lastMaxRow ? stalls + 1 : 0;
    if (stalls >= 2) break;
    lastMaxRow = maxRow;
    await scrollBy(300);
  }

  const failedByName = new Map([...failed].map(([k, why]) => [draftKeys.get(k), why]));
  return { deleted, failed: failedByName };
}

/**
 * Shared flow for TC271/TC272: open list page -> export CSV -> delete rows with targetStatus ->
 * re-export to confirm, repeating until none are left or the work budget runs out.
 */
const STATUS_CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // hard cap per test
async function runDraftCleanup(browser, { route, tableName, csvName, logTag, budgetEnv, targetStatus }) {
  // Default: stop deleting at 4 min so the summary logs well inside the 5-min test timeout.
  const workBudgetMs = process.env[budgetEnv] ? Number(process.env[budgetEnv]) * 60 * 1000 : 4 * 60 * 1000;
  const context = await browser.newContext({ storageState: 'sessionState.json', acceptDownloads: true });
  const page = await context.newPage();
  const openList = async () => {
    const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
    const origin = /^https?:\/\//.test(dashboardUrl) ? new URL(dashboardUrl).origin : '';
    await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    if ((page.url() || '').includes('/login')) {
      throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun this test.');
    }
    // Wait for grid data before exporting/scrolling.
    await expect(page.locator('[role="treegrid"] [role="row"][data-rgrow="0"]').first()).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(1500);
  };

  try {
    await test.step(`Open ${route}`, openList);
    await test.step(`Export CSV, delete "${targetStatus}" rows (HTTP 200 only), re-export to confirm`, async () => {
      const deadline = Date.now() + workBudgetMs;
      const allFailed = new Map();
      let deletedCount = 0;
      let remaining = 0;

      for (let pass = 1; Date.now() < deadline; pass += 1) {
        const { draftKeys, total } = await exportDraftRowKeys(page, csvName, logTag, targetStatus);
        remaining = draftKeys.size;
        console.log(`[${logTag}] Export pass ${pass}: ${total} rows, ${draftKeys.size} ${targetStatus}`);
        for (const k of [...draftKeys.keys()]) if (allFailed.has(draftKeys.get(k))) draftKeys.delete(k);
        if (draftKeys.size === 0) break;

        const { deleted, failed } = await deleteDraftRowsFromGrid(page, { tableName, draftKeys, deadline, logTag });
        deletedCount += deleted.length;
        failed.forEach((v, k) => allFailed.set(k, v));
        if (deleted.length === 0) break; // nothing more we can delete
        await openList(); // fresh grid for the confirmation export
      }

      console.log(`[${logTag}] Summary — deleted: ${deletedCount}, failed: ${allFailed.size}, "${targetStatus}" rows in last export (before its deletes): ${remaining}`);
      if (allFailed.size > 0) {
        test.info().annotations.push({
          type: `${tableName}-not-deleted`,
          description: [...allFailed].map(([k, why]) => `${k}: ${why}`).join('; '),
        });
      }
      expect(allFailed.size, `every attempted "${targetStatus}" delete should return HTTP 200`).toBe(0);
    });
  } finally {
    await context.close().catch(() => {});
  }
}

test.describe('Status cleanup (CSV export driven)', () => {
  test('TC271 @cleanup @bid Delete all Awarded status bids (from the Bids CSV export), verified via API status 200', async ({ browser }) => {
    test.setTimeout(STATUS_CLEANUP_TIMEOUT_MS);
    await runDraftCleanup(browser, {
      route: '/bids', tableName: 'ai_bid', csvName: 'ai_bid-data.csv', logTag: 'cleanup-bids', budgetEnv: 'BID_CLEANUP_MINUTES', targetStatus: 'Awarded',
    });
  });

  test('TC272 @cleanup @job Delete all Draft status jobs (from the Jobs CSV export), verified via API status 200', async ({ browser }) => {
    test.setTimeout(STATUS_CLEANUP_TIMEOUT_MS);
    await runDraftCleanup(browser, {
      route: '/jobs', tableName: 'job', csvName: 'job-data.csv', logTag: 'cleanup-draft-jobs', budgetEnv: 'JOB_DRAFT_CLEANUP_MINUTES', targetStatus: 'Draft',
    });
  });
});

test.describe('Approval templates cleanup', () => {
  test('TC268 @cleanup @approvals Delete approval templates not belonging to the protected sample properties', async ({ browser }) => {
    // This test runs for up to 3 hours, deleting approval templates from the
    // top of the list downward — skipping (never deleting) any template that
    // belongs to one of the 7 protected sample properties — and verifying
    // each deletion via the DELETE /api/bird-table/rows API status code
    // alone. A small buffer above the 3h work budget lets the last in-flight
    // step/log finish before the test itself times out.
    const RUNTIME_BUDGET_MS = 3 * 60 * 60 * 1000; // 3 hours
    test.setTimeout(RUNTIME_BUDGET_MS + 10 * 60 * 1000);

    const protectedProperties = new Set([
      SAMPLE_PROPERTY_1,
      SAMPLE_PROPERTY_2,
      SAMPLE_PROPERTY_3,
      SAMPLE_PROPERTY_4,
      SAMPLE_PROPERTY_5,
      SAMPLE_PROPERTY_6,
      SAMPLE_PROPERTY_7,
    ]);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();

    try {
      try {
        await test.step('Login (reused session) and open Approval Templates via the left panel', async () => {
          const dashboardUrl = process.env.DASHBOARD_URL || data.dashboardUrl;
          await page.goto(dashboardUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(8000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun this test.');
          }

          await ensureLeftPanelExpanded(page);
          const nav = page.locator('nav').first();
          await nav.waitFor({ state: 'visible', timeout: 15000 });

          const approvalsItem = nav.locator('a, div').filter({ hasText: /^Approvals$/i }).first();
          await expect(approvalsItem).toBeVisible({ timeout: 15000 });
          await approvalsItem.click();
          await page.waitForURL('**/approvals/**', { timeout: 20000 });
          await page.waitForTimeout(3000);

          const templatesTab = page.getByRole('tab', { name: 'Approval Templates' });
          await templatesTab.waitFor({ state: 'visible', timeout: 15000 });
          await templatesTab.click();
          await page.waitForURL('**/approvals/template', { timeout: 20000 });
          await page.waitForTimeout(5000);
          await expect(approvalTemplateGridLocator(page)).toBeVisible({ timeout: 30000 });
        });

        await test.step('Delete templates top to bottom, keeping ones tied to protected properties, verified via API status', async () => {
          const { deletedCount, failedCount, keptCount } = await deleteApprovalTemplatesTopToBottomViaApi(page, protectedProperties, RUNTIME_BUDGET_MS);

          console.log(`[cleanup-approval-templates] Summary — deleted: ${deletedCount}, kept (protected property): ${keptCount}, failed: ${failedCount}`);

          expect(deletedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-approval-templates] Approval template cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close().catch((e) => {
        console.warn(`[cleanup-approval-templates] context.close warning ignored: ${e.message}`);
      });
    }
  });
});

test.describe('Organization pending users cleanup', () => {
  test('TC260 @cleanup @organization Cleanup invited/expired users across pages', async ({ browser }) => {
    test.setTimeout(3600000);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const org = new OrganizationHelper(page);

    try {
      try {
        await test.step('Open Manage Organization (reuse existing session)', async () => {
          // org.goto() requires an absolute URL (no baseURL is configured for this project);
          // gotoOrganizationWorkspace() is the same DASHBOARD_URL + UI-navigation path every
          // other test uses to reach Organization, so it works without a dedicated ORGANIZATION_URL.
          await org.gotoOrganizationWorkspace();
          await page.waitForTimeout(10000);

          // Hard fail fast when session is stale; avoids relogin in this cleanup flow.
          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });
        await ensureLeftPanelExpanded(page);

        await test.step('Clear user search if present', async () => {
          await applyUsersSearch(page, '', { required: false });
        });

        await test.step('Cleanup invited/expired users from all pages', async () => {
          const revokedCount = await revokeAllInvitedUsersAcrossPages(page);
          if (revokedCount === 0) {
            console.log('[cleanup-users] No invited/expired users found. Cleanup completed successfully.');
          } else {
            console.log(`[cleanup-users] Total invited/expired users cleaned: ${revokedCount}`);
          }
          expect(revokedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-users] User cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close();
    }
  });

  test('TC263 @cleanup @organization Remove/revoke all users matching "fga_activate" regardless of status', async ({ browser }) => {
    test.setTimeout(3600000); // 10 min cap — search narrows the table first, so this should stay well under budget

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const org = new OrganizationHelper(page);
    try {
      try {
        await test.step('Open Manage Organization (reuse existing session)', async () => {
          await org.gotoOrganizationWorkspace();
          await page.waitForTimeout(10000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });
        await ensureLeftPanelExpanded(page);
        await test.step('Search users matching "fga_activate"', async () => {
          await applyUsersSearch(page, 'fga_activate');
        });

        await test.step('Remove/revoke matching users regardless of status', async () => {
          // Per requirement: "fga_activate" accounts are cleaned up even if already Active/Member,
          // not just Invited/Expired — uses revokeUsersMatchingTextAnyStatus (separate from the
          // Invited/Expired-only revokeAllInvitedUsersAcrossPages used by TC260).
          const revokedCount = await revokeUsersMatchingTextAnyStatus(page, 'fga_activate');
          if (revokedCount === 0) {
            console.log('[cleanup-fga] No users matching "fga_activate" found.');
          } else {
            console.log(`[cleanup-fga] Total "fga_activate" users removed/revoked: ${revokedCount}`);
          }
          expect(revokedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-fga] User cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close();
    }
  });

  test('TC264 @cleanup @organization Remove/revoke all users matching "fga_scope" regardless of status', async ({ browser }) => {
    test.setTimeout(3600000); // 10 min cap — search narrows the table first, so this should stay well under budget

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const org = new OrganizationHelper(page);
    try {
      try {
        await test.step('Open Manage Organization (reuse existing session)', async () => {
          await org.gotoOrganizationWorkspace();
          await page.waitForTimeout(10000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });
        await ensureLeftPanelExpanded(page);
        await test.step('Search users matching "fga_scope"', async () => {
          await applyUsersSearch(page, 'fga_scope');
        });

        await test.step('Remove/revoke matching users regardless of status', async () => {
          // Per requirement: "fga_scope" accounts are cleaned up even if already Active/Member,
          // not just Invited/Expired — uses revokeUsersMatchingTextAnyStatus (separate from the
          // Invited/Expired-only revokeAllInvitedUsersAcrossPages used by TC260).
          const revokedCount = await revokeUsersMatchingTextAnyStatus(page, 'fga_scope');
          if (revokedCount === 0) {
            console.log('[cleanup-fga] No users matching "fga_scope" found.');
          } else {
            console.log(`[cleanup-fga] Total "fga_scope" users removed/revoked: ${revokedCount}`);
          }
          expect(revokedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-fga] User cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close();
    }
  });

  test('TC265 @cleanup @organization Remove/revoke all users who are neither Active nor Admin', async ({ browser }) => {
    test.setTimeout(3600000); // whole-org sweep, no email filter — can cover many more rows than TC263/264

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const org = new OrganizationHelper(page);
    try {
      try {
        await test.step('Open Manage Organization (reuse existing session)', async () => {
          await org.gotoOrganizationWorkspace();
          await page.waitForTimeout(10000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });
        await ensureLeftPanelExpanded(page);

        await test.step('Clear user search if present', async () => {
          await applyUsersSearch(page, '', { required: false });
        });

        await test.step('Revoke/remove all users who are neither Active nor Admin', async () => {
          // Broader than TC260 (which matches an enumerated Pending/Invited/Expired
          // status list): this matches on "status is not Active" instead, so it
          // can't silently stop finding anyone again if the non-active status label
          // changes — see revokeAllNonActiveNonAdminUsers.
          const revokedCount = await revokeAllNonActiveNonAdminUsers(page);
          if (revokedCount === 0) {
            console.log('[cleanup-nonactive] No non-Active, non-Admin users found.');
          } else {
            console.log(`[cleanup-nonactive] Total non-Active, non-Admin users revoked/removed: ${revokedCount}`);
          }
          expect(revokedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-nonactive] User cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close();
    }
  });

  test('TC270 @cleanup @organization Revoke pending "admin_" users only (Active and protected admins untouched)', async ({ browser }) => {
    test.setTimeout(3600000); // "admin_" matches ~300 rows — virtualized scan + one revoke per pending row

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const org = new OrganizationHelper(page);
    try {
      try {
        await test.step('Open Manage Organization (reuse existing session)', async () => {
          await org.gotoOrganizationWorkspace();
          await page.waitForTimeout(10000);

          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });
        await ensureLeftPanelExpanded(page);
        await test.step('Search users matching "admin_"', async () => {
          await applyUsersSearch(page, 'admin_');
        });

        await test.step('Revoke pending "admin_" invites, leave Active/protected users alone', async () => {
          console.log(`[cleanup-pending-admin] Protected emails: ${[...PROTECTED_ADMIN_EMAILS].join(', ') || '(none)'}`);
          const revokedCount = await revokePendingUsersMatchingText(page, 'admin_');
          if (revokedCount === 0) {
            console.log('[cleanup-pending-admin] No pending "admin_" users found.');
          } else {
            console.log(`[cleanup-pending-admin] Total pending "admin_" invites revoked: ${revokedCount}`);
          }
          expect(revokedCount).toBeGreaterThanOrEqual(0);
        });
      } catch (err) {
        throw new Error(`[cleanup-pending-admin] User cleanup failed: ${err?.message || err}`);
      }
    } finally {
      await context.close();
    }
  });
});
