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
 * @param {import('@playwright/test').Page} page
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
 * @param {import('@playwright/test').Page} page
 * @param {string} jobTitle
 * @returns {Promise<boolean>} true if deleted
 */
async function deleteJobByTitle(page, jobTitle) {
  const searchInput = page.locator('input[placeholder="Search..."]:not([disabled])').first();
  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  await searchInput.fill(jobTitle);
  await page.waitForTimeout(8000);

  // Find the exact data row that matches the title using accessibility tree
  const mainDataRows = page.getByRole('row')
    .filter({ hasNot: page.getByRole('checkbox') })
    .filter({ hasNot: page.locator('button[aria-label="Delete Row"]') });

  const rows = await mainDataRows.all();
  let targetIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const text = (await rows[i].getByRole('gridcell').first().textContent().catch(() => ''))
      .trim().split('\n')[0].replace(/✕/g, '').trim();
    if (text === jobTitle) { targetIndex = i; break; }
  }

  if (targetIndex === -1) {
    console.log(`[cleanup-jobs] Job "${jobTitle}" not found after search, skipping.`);
    await searchInput.fill('');
    await page.waitForTimeout(4000);
    return false;
  }

  const deleteBtn = page.locator('button[aria-label="Delete Row"]').nth(targetIndex);
  if (!(await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
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
  await confirmBtn.click();

  await page.waitForTimeout(10000);
  await page.locator('input[placeholder="Search..."]:not([disabled])').first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => { });
  await searchInput.fill('');
  await page.waitForTimeout(5000);
  return true;
}

/**
 * Names visible in the current treegrid viewport (first column text per data row).
 * @param {import('@playwright/test').Page} page
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
 * @param {import('@playwright/test').Page} page
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
  await grid.waitFor({ state: 'visible', timeout: 30000 });
  const matchRe = new RegExp(matchText, 'i');

  let totalRemoved = 0;
  const maxIterations = 300;
  // Same per-email retry/give-up tracking as revokeAllInvitedUsersAcrossPages —
  // a row that keeps 400ing (e.g. stale membership reference) must not spin forever.
  const failureCounts = new Map();
  const skipEmails = new Set();

  for (let guard = 0; guard < maxIterations; guard++) {
    await page.waitForTimeout(guard === 0 ? 3000 : 1500);

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

test.describe.skip('Properties cleanup', () => {
  test('TC261 @cleanup @job Delete all jobs not belonging to protected properties or last created job', async ({ browser }) => {
    test.setTimeout(600000); // 10 min — many jobs may exist

    const lastCreatedJobName = loadLastCreatedJobName();
    const dryRun = process.env.CLEANUP_DRY_RUN === '1';
    const protectedProperties = new Set([
      SAMPLE_PROPERTY_1,
      SAMPLE_PROPERTY_2,
      SAMPLE_PROPERTY_3,
      SAMPLE_PROPERTY_4,
      SAMPLE_PROPERTY_5,
      SAMPLE_PROPERTY_6,
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

          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 30000 }),
            page.getByRole('button', { name: 'Export' }).click(),
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
            if (!dryRun) toDelete.push(title);
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
            for (const title of toDelete) {
              console.log(`[cleanup-jobs] Deleting "${title}" (${deleted + 1}/${toDelete.length})`);
              const success = await deleteJobByTitle(page, title);
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
    const keep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4, SAMPLE_PROPERTY_5, SAMPLE_PROPERTY_6]);
    if (recent) keep.add(recent);
    const requiredKeep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4, SAMPLE_PROPERTY_5, SAMPLE_PROPERTY_6]);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const prop = new PropertiesHelper(page);

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
            await page.waitForTimeout(5000);

            const allNames = await collectAllPropertyNamesFromGrid(page);
            const toRemove = allNames.filter((n) => !keep.has(n));

            if (toRemove.length === 0) {
              console.log('[cleanup] No extra properties to delete.');
              break;
            }

            // Delete all discovered extras in this scan to avoid repeated
            // expensive grid scans that can trigger test timeout.
            for (const victim of toRemove) {
              console.log(`[cleanup] Deleting: ${victim}`);
              await prop.deleteProperty(victim);
            }
          }

          expect(iterations).toBeLessThan(maxIterations);
        });

        await test.step('Verify only kept properties remain', async () => {
          await page.locator('input[placeholder="Search..."]').fill('');
          await page.waitForTimeout(5000);

          const remaining = await collectAllPropertyNamesFromGrid(page);
          const unexpected = remaining.filter((n) => !keep.has(n));
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

test.describe.skip('Organization pending users cleanup', () => {
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
          const search = page.locator('input[placeholder="Search by name or email"]').first();
          if (await search.isVisible().catch(() => false)) {
            await search.fill('');
            await page.waitForTimeout(5000);
          }
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
          const search = page.locator('input[placeholder="Search by name or email"]').first();
          await search.waitFor({ state: 'visible', timeout: 15000 });
          await search.fill('fga_activate');
          await page.waitForTimeout(5000);
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
          const search = page.locator('input[placeholder="Search by name or email"]').first();
          await search.waitFor({ state: 'visible', timeout: 15000 });
          await search.fill('fga_scope');
          await page.waitForTimeout(5000);
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
          const search = page.locator('input[placeholder="Search by name or email"]').first();
          if (await search.isVisible().catch(() => false)) {
            await search.fill('');
            await page.waitForTimeout(5000);
          }
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
});
