require('dotenv').config();

const { test, expect } = require('@playwright/test');

/**
 * Vendor portal cleanup (beta.tailorbird.com/bids-and-contracts), logged in as the vendor user
 * oct30sumit@yopmail.com (same password as TEST_PASSWORD). Override the user with
 * VENDOR_PORTAL_EMAIL / VENDOR_PORTAL_PASSWORD if needed.
 *
 * MCP-verified 2026-11-11:
 *  - Login lands on /bids-and-contracts/dashboard (no organization selection step).
 *  - Invoices list:      GET /api/bird-table?table_name=vendor_invoices
 *    Change orders list: GET /api/bird-table?table_name=vendor_change_orders
 *    Rows with record_type "draft" (id "draft-<n>") are the vendor's own drafts. Submitted
 *    records (Pending Approval / Rejected / owner-side) are view-only for the vendor — no delete
 *    anywhere — and are cleaned on the owner side (TC267 / TC273).
 *  - A draft opens at /bids-and-contracts/<invoices|change-orders>/drafts/<n> with a
 *    "Delete Draft" button -> "Delete draft?" dialog -> Delete fires
 *    DELETE /api/ai-invoice-draft/<n> or DELETE /api/ai-change-order-draft/<n> -> 200, then the
 *    app returns to the list.
 *  - A draft on a locked job returns 400 "This job is locked and cannot be modified." — the vendor
 *    cannot reopen jobs, so such drafts are skipped.
 * Success is decided by the HTTP status code only. A 400 is retried up to 2 times; anything that
 * still can't be deleted is skipped and the run moves on (never fails because of a skip).
 */

const BASE = 'https://beta.tailorbird.com';
const VENDOR_EMAIL = process.env.VENDOR_PORTAL_EMAIL || 'oct30sumit@yopmail.com';
const VENDOR_PASSWORD = process.env.VENDOR_PORTAL_PASSWORD || process.env.TEST_PASSWORD;
const RUNTIME_BUDGET_MS = 60 * 60 * 1000; // 1 hour cap per test

/** Logs the vendor in through AuthKit and waits for the vendor portal. */
async function loginAsVendor(page) {
  if (!VENDOR_PASSWORD) throw new Error('TEST_PASSWORD (or VENDOR_PORTAL_PASSWORD) is not set.');
  await page.goto(process.env.LOGIN_URL, { waitUntil: 'load' });
  const email = page.locator('input[name="email"], input[type="email"]');
  await email.waitFor({ state: 'visible', timeout: 30000 });
  await email.fill(VENDOR_EMAIL);
  await page.locator('button[type="submit"]:has-text("Continue")').click();
  const password = page.locator('input[name="password"], input[type="password"]');
  await password.waitFor({ state: 'visible', timeout: 30000 });
  await password.fill(VENDOR_PASSWORD);
  await page.locator('button[name="intent"]:has-text("Sign in")').click();
  await page.waitForURL(/\/bids-and-contracts\//, { timeout: 60000 });
}

/**
 * Deletes every vendor draft of one kind, oldest list order first.
 * @param {'invoices'|'change-orders'} kind
 */
async function deleteVendorDrafts(page, kind, maxRuntimeMs) {
  const cfg = {
    invoices: { table: 'vendor_invoices', api: 'ai-invoice-draft', tag: '[vendor-invoice-drafts]' },
    'change-orders': { table: 'vendor_change_orders', api: 'ai-change-order-draft', tag: '[vendor-co-drafts]' },
  }[kind];
  const MAX_RETRIES = 2;
  const deadline = Date.now() + maxRuntimeMs;
  const skipped = new Map(); // draft number -> reason
  let deleted = 0;

  const listDrafts = () => page.evaluate(async (table) => {
    const res = await fetch(`/api/bird-table?table_name=${table}`);
    const j = await res.json();
    return (j.rows || [])
      .filter((r) => r.record_type === 'draft' && /^draft-\d+$/.test(String(r.id)))
      .map((r) => ({ n: String(r.id).replace('draft-', ''), jobId: r.job_id, contract: r.contract_title }));
  }, cfg.table);

  const attemptDelete = async (n) => {
    await page.goto(`${BASE}/bids-and-contracts/${kind}/drafts/${n}`, { waitUntil: 'domcontentloaded' });
    const delBtn = page.getByRole('button', { name: 'Delete Draft' });
    if (!(await delBtn.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false))) {
      return { status: 0, body: 'no "Delete Draft" button on the draft page' };
    }
    await delBtn.click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Delete draft?' }).first();
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    const respPromise = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && r.url().includes(`/api/${cfg.api}/${n}`),
      { timeout: 60000 },
    ).catch(() => null);
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    const resp = await respPromise;
    if (!resp) return { status: -1, body: 'no DELETE response within 60s' };
    // Status decides success; body only read on failure, capped at 2s (it can be slow).
    const body = resp.status() === 200
      ? ''
      : await Promise.race([resp.text().catch(() => ''), new Promise((r) => setTimeout(() => r(''), 2000))]);
    return { status: resp.status(), body };
  };

  let pass = 0;
  while (Date.now() < deadline) {
    pass += 1;
    const drafts = (await listDrafts()).filter((d) => !skipped.has(d.n));
    console.log(`${cfg.tag} Pass ${pass}: ${drafts.length} deletable draft(s) to try (${skipped.size} skipped so far).`);
    if (drafts.length === 0) break;

    let progress = 0;
    for (const d of drafts) {
      if (Date.now() >= deadline) break;
      let result = await attemptDelete(d.n).catch((e) => ({ status: -1, body: String(e.message || e).split('\n')[0] }));
      for (let retry = 1; retry <= MAX_RETRIES && result.status === 400; retry++) {
        console.log(`${cfg.tag} Draft #${d.n} got HTTP 400 — retry ${retry}/${MAX_RETRIES} in 3s.`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(3000);
        result = await attemptDelete(d.n).catch((e) => ({ status: -1, body: String(e.message || e).split('\n')[0] }));
      }
      if (result.status === 200) {
        deleted += 1;
        progress += 1;
        console.log(`${cfg.tag} Deleted draft #${d.n} (job ${d.jobId}, ${d.contract}) (HTTP 200) — total deleted: ${deleted}`);
      } else {
        const reason = `HTTP ${result.status} ${result.body}`.slice(0, 200);
        skipped.set(d.n, reason);
        console.log(`${cfg.tag} Could not delete draft #${d.n} (job ${d.jobId}): ${reason} — skipping to the next one.`);
        await page.keyboard.press('Escape').catch(() => {});
      }
    }
    if (progress === 0) break;
  }

  if (Date.now() >= deadline) console.log(`${cfg.tag} Time budget reached, stopping.`);
  return { deleted, skipped };
}

async function runVendorDraftCleanup(browser, kind, envMinutes) {
  test.setTimeout(RUNTIME_BUDGET_MS);
  const workBudgetMs = process.env[envMinutes]
    ? Number(process.env[envMinutes]) * 60 * 1000
    : RUNTIME_BUDGET_MS - 3 * 60 * 1000;
  const context = await browser.newContext();
  const page = await context.newPage();
  const tag = kind === 'invoices' ? '[vendor-invoice-drafts]' : '[vendor-co-drafts]';
  try {
    await test.step(`Log in to the vendor portal as ${VENDOR_EMAIL}`, async () => {
      await loginAsVendor(page);
      await page.goto(`${BASE}/bids-and-contracts/${kind}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('input[placeholder="Search..."]').first()).toBeVisible({ timeout: 60000 });
    });
    await test.step(`Delete vendor ${kind} drafts (HTTP 200 only; skip what cannot be deleted)`, async () => {
      const { deleted, skipped } = await deleteVendorDrafts(page, kind, workBudgetMs);
      console.log(`${tag} Summary — deleted: ${deleted}, skipped: ${skipped.size}`);
      if (skipped.size > 0) {
        const list = [...skipped].map(([n, why]) => `#${n}: ${why}`);
        test.info().annotations.push({ type: `vendor-${kind}-skipped`, description: list.join('; ').slice(0, 8000) });
      }
    });
  } finally {
    await context.close().catch(() => {});
  }
}

test.describe('Vendor portal cleanup', () => {
  test('TC275 @cleanup @vendor @invoice Delete vendor portal invoice drafts, verified via API status 200', async ({ browser }) => {
    await runVendorDraftCleanup(browser, 'invoices', 'VENDOR_INVOICE_CLEANUP_MINUTES');
  });

  test('TC276 @cleanup @vendor @changeorder Delete vendor portal change order drafts, verified via API status 200', async ({ browser }) => {
    await runVendorDraftCleanup(browser, 'change-orders', 'VENDOR_CO_CLEANUP_MINUTES');
  });
});
