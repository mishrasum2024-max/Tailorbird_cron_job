require('dotenv').config();

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { LoginPage } = require('../pages/loginPage');
const PropertiesHelper = require('../pages/properties');
const OrganizationHelper = require('../pages/organizationHelper');
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
const SAMPLE_PROPERTY_3 = 'Test Property 3_Courtney Ridge Apartments';
const SAMPLE_PROPERTY_4 = 'Test Property 4_Malmstrom';

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
 * Expands "Construction Management" if collapsed before clicking "Jobs (Contracts & POs)".
 * @param {import('@playwright/test').Page} page
 */
async function navigateToJobsViaLeftPanel(page) {
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
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
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
 * Cleans pending users across pages:
 * - Invited => Revoke invitation
 * - Expired => Remove user
 * @param {import('@playwright/test').Page} page
 */
async function revokeAllInvitedUsersAcrossPages(page) {
  const tableRows = page.locator('table tbody tr');
  const nextPageBtn = page
    .locator(
      'button[aria-label*="next" i], button:has-text("Next"), [data-testid*="next" i], button:has(svg.lucide-chevron-right)'
    )
    .first();

  let totalRevoked = 0;
  const maxPages = 100;

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    await page.waitForTimeout(10000);

    let revokedOnThisPage = 0;
    for (let guard = 0; guard < 100; guard++) {
      const rowCount = await tableRows.count();
      if (rowCount === 0) break;

      let targetRow = null;
      let targetStatus = null;
      for (let i = 0; i < rowCount; i++) {
        const row = tableRows.nth(i);
        const rowText = (await row.innerText().catch(() => '')).trim();
        const isInvited = /Invited/i.test(rowText);
        const isExpired = /Expired/i.test(rowText);
        if (isInvited || isExpired) {
          targetRow = row;
          targetStatus = isExpired ? 'expired' : 'invited';
          break;
        }
      }

      if (!targetRow) break;

      const emailText = (
        (await targetRow.locator('td').nth(1).innerText().catch(() => '')) ||
        (await targetRow.innerText().catch(() => ''))
      ).trim();

      const actionButton = targetRow
        .locator('button[title="User actions"], button[aria-label*="user action" i], button:has(svg.lucide-ellipsis-vertical)')
        .first();
      await actionButton.click();

      let actionItem;
      if (targetStatus === 'expired') {
        actionItem = page
          .locator('role=menuitem >> text=/Remove user|Remove invitation|Remove|Delete/i')
          .first();
      } else {
        actionItem = page
          .locator('role=menuitem >> text=/Revoke invitation|Revoke invite/i')
          .first();
      }
      await actionItem.click();

      const confirmDialog = page.locator('[role="alertdialog"], [role="dialog"]').filter({
        hasText: targetStatus === 'expired'
          ? /Remove user|Remove invitation|Remove|Delete/i
          : /Revoke invitation|Revoke invite/i
      }).first();
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });

      const confirmBtn = confirmDialog
        .locator(
          targetStatus === 'expired'
            ? 'button:has-text("Remove"), button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
            : 'button:has-text("Revoke"), button:has-text("Confirm"), button:has-text("Yes")'
        )
        .first();
      await confirmBtn.click();

      await confirmDialog.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(5000);

      revokedOnThisPage += 1;
      totalRevoked += 1;
      console.log(`[cleanup-users] ${targetStatus === 'expired' ? 'Removed expired' : 'Revoked invited'} user: ${emailText || 'unknown'}`);
    }

    const nextVisible = await nextPageBtn.isVisible().catch(() => false);
    if (!nextVisible) break;

    const nextDisabled = await nextPageBtn.isDisabled().catch(async () => {
      const ariaDisabled = await nextPageBtn.getAttribute('aria-disabled').catch(() => null);
      return ariaDisabled === 'true';
    });
    if (nextDisabled) break;

    const before = await tableRows.first().innerText().catch(() => '');
    await nextPageBtn.click();
    await page.waitForTimeout(10000);
    const after = await tableRows.first().innerText().catch(() => '');

    if (before === after && revokedOnThisPage === 0) break;
  }

  return totalRevoked;
}

test.describe('Properties cleanup', () => {
  test('TC261 @cleanup @job Delete all jobs not belonging to protected properties or last created job', async ({ browser }) => {
    test.setTimeout(600000); // 10 min — many jobs may exist

    const lastCreatedJobName = loadLastCreatedJobName();
    const dryRun = process.env.CLEANUP_DRY_RUN === '1';
    const protectedProperties = new Set([
      SAMPLE_PROPERTY_1,
      SAMPLE_PROPERTY_2,
      SAMPLE_PROPERTY_3,
      SAMPLE_PROPERTY_4,
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
    test.setTimeout(2700000);

    const recent = loadRecentPropertyName();
    const keep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4]);
    if (recent) keep.add(recent);
    const requiredKeep = new Set([SAMPLE_PROPERTY_1, SAMPLE_PROPERTY_2, SAMPLE_PROPERTY_3, SAMPLE_PROPERTY_4]);

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
});

test.describe('Organization pending users cleanup', () => {
  test('TC260 @cleanup @organization Cleanup invited/expired users across pages', async ({ browser }) => {
    test.setTimeout(600000);

    const context = await browser.newContext({ storageState: 'sessionState.json' });
    const page = await context.newPage();
    const org = new OrganizationHelper(page);

    try {
      try {
        await test.step('Open Manage Organization (reuse existing session)', async () => {
          await org.goto(process.env.ORGANIZATION_URL || '/organization');
          await page.waitForTimeout(10000);

          // Hard fail fast when session is stale; avoids relogin in this cleanup flow.
          if ((page.url() || '').includes('/login')) {
            throw new Error('sessionState.json is not authenticated. Refresh sessionState once, then rerun cleanup.');
          }
        });

        await test.step('Clear user search if present', async () => {
          const search = page.locator('input[placeholder="Search by name or e-mail"]').first();
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
});
