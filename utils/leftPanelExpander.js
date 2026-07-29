/**
 * leftPanelExpander.js
 *
 * The left navigation panel now loads collapsed (icon-only rail, ~68px) instead
 * of expanded. Hovering over the rail reveals full labels plus a "Pin sidebar"
 * button (MCP-verified on beta.tailorbird.com); clicking it persists the
 * expanded state (localStorage: tb-sidebar-pinned) across reloads/navigation.
 *
 * This utility expands + pins the panel only when it is actually collapsed,
 * so it is safe to call repeatedly with no side effects.
 *
 * Usage:
 *   const { ensureLeftPanelExpanded } = require('../utils/leftPanelExpander');
 *   await ensureLeftPanelExpanded(page);
 */
const { expect } = require('@playwright/test');
const { Logger } = require('./logger');

const NAVBAR_SELECTOR = '.mantine-AppShell-navbar';
// Collapsed rail renders ~68px wide; expanded/pinned renders ~224px wide, AT THE
// PAGE'S NATIVE (unzoomed) SCALE. Some test suites apply CSS `zoom` to the navbar
// for screenshot-baseline matching — and a few also zoom an ANCESTOR (e.g. `body`)
// at the same time, which compounds multiplicatively (MCP-confirmed: zooming both
// `body` and `.mantine-AppShell-navbar` to 70% each produces an effective ~49%
// zoom, not 70%). A fixed pixel threshold breaks under that compounding, so this
// is scaled per-call by the page's actual effective zoom — see getEffectiveZoom().
const COLLAPSED_WIDTH_THRESHOLD = 120;
// Exact attribute selectors (MCP-verified on beta.tailorbird.com), not regex-based
// name matching: the button has a stable aria-label ("Pin sidebar" / "Unpin sidebar")
// and a regex like /pin sidebar/i would also match "Unpin sidebar" since it contains
// "pin sidebar" as a substring. A plain attribute-equals selector has no such ambiguity.
const PIN_BUTTON_SELECTOR = 'button[aria-label="Pin sidebar"]';
const UNPIN_BUTTON_SELECTOR = 'button[aria-label="Unpin sidebar"]';
// The Tailorbird logo renders at a fixed intrinsic 35px wide (HTML width attribute)
// regardless of collapsed/expanded state, making it a reliable, state-independent
// reference for detecting whatever effective zoom the calling page has applied.
const LOGO_SELECTOR = 'img[alt="Tailorbird Logo"]';
const LOGO_INTRINSIC_WIDTH = 35;

async function getNavbarWidth(page) {
    const navbar = page.locator(NAVBAR_SELECTOR).first();
    return navbar.evaluate((el) => el.getBoundingClientRect().width);
}

/**
 * Effective zoom currently applied to the navbar (1 = native scale), derived
 * from the logo's rendered width vs its known intrinsic width. Falls back to 1
 * (native scale) if the logo can't be measured, matching pre-zoom-aware behavior.
 */
async function getEffectiveZoom(navbar) {
    const width = await navbar
        .locator(LOGO_SELECTOR)
        .first()
        .evaluate((el) => el.getBoundingClientRect().width)
        .catch(() => null);
    if (!width) return 1;
    return width / LOGO_INTRINSIC_WIDTH;
}

// Max hover+pin attempts before giving up. CI runners (headless, slower/loaded
// machines) have been observed to occasionally miss the hover-triggered reveal
// or the pin click not registering in time, where a local headed run doesn't.
const MAX_PIN_ATTEMPTS = 3;

/**
 * True only when the panel is CONCRETELY confirmed pinned open: the "Unpin
 * sidebar" button is visible AND the navbar is actually wide (relative to
 * this page's own effective zoom). Either signal alone can be transiently
 * true without the other (e.g. a live hover-expand that isn't pinned yet),
 * so both are required before we trust the state.
 */
async function isPanelConfirmedPinned(page, navbar) {
    const unpinVisible = await navbar.locator(UNPIN_BUTTON_SELECTOR).first().isVisible().catch(() => false);
    if (!unpinVisible) return false;
    const width = await getNavbarWidth(page).catch(() => 0);
    const zoom = await getEffectiveZoom(navbar);
    return width >= COLLAPSED_WIDTH_THRESHOLD * zoom;
}

/**
 * Triggers the hover-reveal through three independent mechanisms so the
 * reveal isn't dependent on any single one working in a given environment:
 * headless/CI Chromium has been observed to not reliably register the
 * single-jump pointer move that Locator.hover() performs on its own, where a
 * local headed run doesn't show the same gap.
 *   1. A real, multi-step mouse move to the navbar's center (page.mouse.move
 *      with steps) — closer to genuine pointer movement than a single jump.
 *   2. Locator.hover() as a second, actionability-checked pointer move.
 *   3. Direct mouseenter/mouseover dispatch on the navbar element — confirmed
 *      (via live DOM inspection) to independently trigger this app's
 *      hover-expand state, regardless of pointer simulation quirks.
 */
async function triggerNavbarHover(page, navbar) {
    const box = await navbar.boundingBox().catch(() => null);
    if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + Math.min(100, box.height / 2), { steps: 15 }).catch(() => { });
    }
    await navbar.hover().catch(() => { });
    await navbar.dispatchEvent('mouseenter').catch(() => { });
    await navbar.dispatchEvent('mouseover').catch(() => { });
}

/**
 * Expands the left navigation panel and pins it open, but only if it is
 * currently collapsed. Does nothing if the panel is already expanded/pinned.
 * Retries the hover+pin sequence up to MAX_PIN_ATTEMPTS times, re-verifying
 * the concrete pinned state after each attempt, before giving up.
 * @param {import('@playwright/test').Page} page
 */
async function ensureLeftPanelExpanded(page) {
    const navbar = page.locator(NAVBAR_SELECTOR).first();
    await navbar.waitFor({ state: 'visible', timeout: 35000 });

    if (await isPanelConfirmedPinned(page, navbar)) {
        Logger.info('[LeftPanelExpander] Panel already pinned open — no action taken.');
        return;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= MAX_PIN_ATTEMPTS; attempt++) {
        try {
            const width = await getNavbarWidth(page);
            Logger.info(
                `[LeftPanelExpander] Attempt ${attempt}/${MAX_PIN_ATTEMPTS}: panel not confirmed pinned (width=${width}px) — expanding and pinning.`
            );
            await triggerNavbarHover(page, navbar);

            const pinButton = navbar.locator(PIN_BUTTON_SELECTOR).first();
            await pinButton.waitFor({ state: 'visible', timeout: 45000 });
            await pinButton.click();

            await expect(navbar.locator(UNPIN_BUTTON_SELECTOR).first()).toBeVisible({ timeout: 15000 });
            const zoom = await getEffectiveZoom(navbar);
            await expect.poll(() => getNavbarWidth(page), { timeout: 15000 }).toBeGreaterThanOrEqual(COLLAPSED_WIDTH_THRESHOLD * zoom);

            if (await isPanelConfirmedPinned(page, navbar)) {
                Logger.success(`[LeftPanelExpander] Panel expanded and pinned open (attempt ${attempt}/${MAX_PIN_ATTEMPTS}).`);
                return;
            }
            throw new Error('Pin click did not result in a confirmed pinned state.');
        } catch (err) {
            lastError = err;
            const willRetry = attempt < MAX_PIN_ATTEMPTS;
            Logger.info(
                `[LeftPanelExpander] Attempt ${attempt}/${MAX_PIN_ATTEMPTS} failed to confirm pinned state (${err.message}).${willRetry ? ' Retrying...' : ' No attempts left.'}`
            );
        }
    }

    throw new Error(`[LeftPanelExpander] Failed to confirm left panel pinned open after ${MAX_PIN_ATTEMPTS} attempts: ${lastError?.message}`);
}

module.exports = { ensureLeftPanelExpanded };
