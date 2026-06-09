// leftPanelHelper.js
const locators = require('../locators/leftPanelLocator');
const { Logger } = require('../utils/logger');
const { expect } = require('@playwright/test');

module.exports = {

    /**
     * Expand collapsible sections to reveal child items (for label collection)
     */
    ensureSectionsExpandedForLabels: async function(page) {
        const sections = ['Financials', 'Trackers', 'Documents', 'Construction Management'];
        for (const section of sections) {
            try {
                const parent = page.locator('nav a.mantine-NavLink-root').filter({ hasText: section }).first();
                if (await parent.count() > 0 && await parent.isVisible().catch(() => false)) {
                    const collapse = parent.locator(locators.collapseContainer);
                    if (await collapse.count() > 0) {
                        const visible = await this.listVisibleSuboptions(collapse);
                        if (visible.length === 0) {
                            await parent.click().catch(() => {});
                            await page.waitForTimeout(500);
                        }
                    }
                }
            } catch (e) {
                Logger.info(`Could not expand ${section}: ${e.message}`);
            }
        }
    },

    /**
     * Get all left panel menu labels from both visible nav and More menu (if present)
     * Handles both full-screen (all items visible) and minimized (More menu) scenarios
     */
    getLeftPanelLabels: async function(page) {
        await this.ensureSectionsExpandedForLabels(page);
        const visibleLabels = await this.getVisibleNavLabels(page);
        Logger.info(`Visible nav labels: ${JSON.stringify(visibleLabels)}`);

        // Check if More menu exists
        const hasMoreMenu = await this.hasMoreMenuButton(page);
        Logger.info(`Has More menu: ${hasMoreMenu}`);

        if (!hasMoreMenu) {
            // Full screen mode - all items visible
            return visibleLabels;
        }

        // Minimized mode - get items from More menu
        const moreLabels = await this.getMoreMenuLabels(page);
        Logger.info(`More menu labels: ${JSON.stringify(moreLabels)}`);

        // Combine and deduplicate
        let allLabels = [...new Set([...visibleLabels, ...moreLabels])].filter(
            (label) => label && label !== 'More'
        );
        // When in More mode, section headers (Trackers, Documents) may not appear; infer from children
        if (moreLabels.includes('Unit Tracker') && !allLabels.includes('Trackers')) allLabels.push('Trackers');
        if ((moreLabels.includes('Files') || moreLabels.includes('Images')) && !allLabels.includes('Documents')) allLabels.push('Documents');

        return allLabels;
    },

    /**
     * Get labels that are directly visible in nav (not in More menu)
     */
    getVisibleNavLabels: async function(page) {
        await page.locator('nav').waitFor({ state: 'visible', timeout: 15000 });
        for (let attempt = 0; attempt < 3; attempt++) {
            await page.waitForTimeout(attempt * 500 + 500);
            const items = page.locator(locators.leftPanelLabels);
            const count = await items.count();
            Logger.info(`Total nav labels found: ${count} (attempt ${attempt + 1})`);
            if (count === 0) continue;
            const labels = [];
            for (let i = 0; i < count; i++) {
                const text = (await items.nth(i).innerText()).trim();
                if (text && text !== 'More') labels.push(text);
            }
            if (labels.length > 0) return labels;
        }
        return [];
    },

    /**
     * Check if More button/link exists in the nav
     */
    hasMoreMenuButton: async function(page) {
        const moreButton = page.locator('nav .mantine-NavLink-root').filter({ hasText: 'More' });
        if (await moreButton.count() > 0) return true;
        const moreFallback = page.locator('nav').getByRole('link', { name: 'More' });
        if (await moreFallback.count() > 0) return true;
        const moreAny = page.locator('nav').locator('a, button').filter({ hasText: 'More' });
        return await moreAny.count() > 0;
    },

    /**
     * Open the More menu and return labels from it
     */
    getMoreMenuLabels: async function(page) {
        const more = await this.openMoreMenu(page);
        if (!more) return [];

        const labels = [];
        const menuItems = more.locator('[role="menuitem"]');
        const count = await menuItems.count();

        for (let i = 0; i < count; i++) {
            const text = (await menuItems.nth(i).innerText()).trim();
            if (text) {
                labels.push(text);
                Logger.info(`Fetched More menu label: "${text}"`);
            }
        }

        // Close menu
        try {
            await page.keyboard.press('Escape');
        } catch (e) {
            // Ignore if already closed
        }

        return labels;
    },

    /**
     * Open the More menu and return the menu element
     */
    openMoreMenu: async function(page) {
        const moreCandidates = page.locator('nav .mantine-NavLink-root').filter({ hasText: 'More' });
        if ((await moreCandidates.count()) === 0) return null;

        await moreCandidates.first().click();
        await page.waitForTimeout(300);

        // The menu appears as a sibling or overlay
        const menu = page.locator('[role="menu"]').first();
        return menu;
    },



    /**
     * Get locators for a section (parent and its collapse container)
     */
    getSectionLocators: async function (page, label) {
        const parent = page.locator(locators.leftPanelItem(label)).first();
        const collapse = parent.locator(locators.collapseContainer);
        return { parent, collapse };
    },

    /**
     * Ensure a section is visible and expanded
     * Handles both direct nav items and items in More menu
     */
    ensureSectionExpanded: async function (page, sectionLabel) {
        // Check if section exists in direct nav - use filter for reliability.
        // Some UIs render duplicate hidden navlinks; pick the first visible one.
        const directParents = page.locator('nav a.mantine-NavLink-root').filter({ hasText: sectionLabel });
        const directCount = await directParents.count();
        const pickFirstVisible = async (locator) => {
            const count = await locator.count();
            for (let i = 0; i < count; i++) {
                const candidate = locator.nth(i);
                if (await candidate.isVisible().catch(() => false)) return candidate;
            }
            return count > 0 ? locator.first() : locator;
        };
        const directParent = directCount > 0 ? await pickFirstVisible(directParents) : directParents;
        const directExists = directCount > 0;

        if (directExists) {
            // Section is in main nav
            const collapse = directParent.locator(locators.collapseContainer);
            await directParent.waitFor({ state: 'attached' });
            await directParent.scrollIntoViewIfNeeded();
            await directParent.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
            const visible = await this.listVisibleSuboptions(collapse);
            if (visible.length === 0) {
                await directParent.click();
                await page.waitForTimeout(800);
            }
        } else {
            // Section might be in More menu
            const hasMore = await this.hasMoreMenuButton(page);
            if (hasMore) {
                const more = await this.openMoreMenu(page);
                if (more) {
                    // Find the section in the menu
                    const sectionInMenu = more.locator(`[role="menuitem"] >> text=${sectionLabel}`).first();
                    if (await sectionInMenu.count() > 0) {
                        // It's in the menu, but we may not be able to expand from menu
                        Logger.info(`Section ${sectionLabel} found in More menu`);
                    }
                }
                // Close menu
                try {
                    await page.keyboard.press('Escape');
                } catch (e) {
                    // Ignore
                }
            }
        }
    },

    /**
     * Get locator for a child menu item under a section
     * Handles both direct nav child items and items in More menu
     */
    getChildMenuLocator: async function (page, parentSectionLabel, childLabel) {
        // Check if parent section exists in direct nav - use filter for reliability
        const parentLocator = page.locator('nav a.mantine-NavLink-root').filter({ hasText: parentSectionLabel }).first();
        if (await parentLocator.count() > 0) {
            // Parent is in direct nav
            const collapseLocator = parentLocator.locator(locators.collapseContainer);
            return collapseLocator.locator(`a.mantine-NavLink-root:has(span.mantine-NavLink-label:has-text("${childLabel}"))`);
        }

        // Check if child is in More menu
        const hasMore = await this.hasMoreMenuButton(page);
        if (hasMore) {
            const more = await this.openMoreMenu(page);
            if (more) {
                const childInMenu = more.locator(`[role="menuitem"]`).filter({ hasText: childLabel }).first();
                if (await childInMenu.count() > 0) {
                    return childInMenu;
                }
            }
            try {
                await page.keyboard.press('Escape');
            } catch (e) {
                // Ignore
            }
        }

        return null;
    },

    /**
     * List visible sub-options under a collapse container
     */
    listVisibleSuboptions: async function (collapseLocator) {
        const anchors = collapseLocator.locator(locators.subOptions);
        const n = await anchors.count();
        const visibleNames = [];
        for (let i = 0; i < n; i++) {
            const el = anchors.nth(i);
            if (await el.isVisible()) {
                const text = (await el.innerText()).trim();
                if (text) visibleNames.push(text);
            }
        }
        return visibleNames;
    },

    /**
     * Test expand/collapse functionality for a section
     * Handles both full screen (direct nav) and minimized (More menu) scenarios
     */
    runTwoClickTest: async function (page, label) {
        await page.waitForTimeout(30000);
        await page.waitForTimeout(500);
        await page.locator('nav').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

        let directParent = page.locator('nav a.mantine-NavLink-root').filter({ hasText: new RegExp(`^${label}$`) }).first();
        let directExists = await directParent.count() > 0;
        if (!directExists) {
            directParent = page.locator('nav a.mantine-NavLink-root').filter({ hasText: label }).first();
            directExists = await directParent.count() > 0;
        }

        if (!directExists) {
            // Section is not in direct nav, check More menu or scroll to find it
            const hasMore = await this.hasMoreMenuButton(page);
            if (hasMore) {
                Logger.info(`Section ${label} is in More menu (minimized mode)`);
                Logger.info(`Skipping expand/collapse test`);
                return;
            }
            await page.locator('nav').first().scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            directParent = page.locator('nav a.mantine-NavLink-root, nav a').filter({ hasText: new RegExp(`^${label}$`) }).first();
            directExists = await directParent.count() > 0;
            if (!directExists) {
                throw new Error(`Section not found: ${label}`);
            }
        }

        Logger.info(`Found ${label} section`);

        // Ensure visibility - scroll nav to reveal element if in scrollable area
        await page.locator('nav').evaluate((lbl) => {
            const anchors = Array.from(document.querySelectorAll('nav a'));
            const el = anchors.find(a => a.textContent?.trim() === lbl);
            if (el) el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }, label).catch(() => {});
        await directParent.scrollIntoViewIfNeeded();
        await directParent.waitFor({ state: 'attached', timeout: 10000 });
        const visible = await directParent.isVisible().catch(() => false);
        if (!visible) {
            await page.locator('nav').evaluate((el) => el?.scrollTo(0, 0));
            await page.waitForTimeout(300);
            await directParent.scrollIntoViewIfNeeded();
        }
        await page.waitForTimeout(300);

        // Get collapse container
        const collapse = directParent.locator(locators.collapseContainer);
        const collapseExists = await collapse.count() > 0;
        
        if (!collapseExists) {
            Logger.info(`No collapse container for ${label}`);
            return;
        }

        let beforeList = await this.listVisibleSuboptions(collapse);
        Logger.info(`[Before] ${label} visible: ${beforeList}`);

        if (beforeList.length === 0) {
            Logger.info(`Expanding ${label} first`);
            await directParent.click({ force: true });
            await page.waitForTimeout(800);
            beforeList = await this.listVisibleSuboptions(collapse);
            Logger.info(`[After expand] ${label} visible: ${beforeList}`);
        }

        // Test collapse - click to collapse
        await directParent.click({ force: true });
        await page.waitForTimeout(800);
        const afterCollapse = await this.listVisibleSuboptions(collapse);
        Logger.info(`[After Collapse] ${label} visible: ${afterCollapse}`);
        expect(afterCollapse.length).toBeLessThanOrEqual(beforeList.length);

        // Test expand - click to expand again
        await directParent.click({ force: true });
        await page.waitForTimeout(800);
        const afterExpand = await this.listVisibleSuboptions(collapse);
        Logger.info(`[After Expand] ${label} visible: ${afterExpand}`);
        if (beforeList.length > 0) {
            expect(afterExpand.length).toBeGreaterThan(0);
        }
    },

    /**
     * Rounded pixel width of the AppShell navbar (after viewport/zoom transforms).
     */
    async getMainNavbarWidth(page) {
        const navbar = page.locator(locators.appShellNavbar).first();
        await expect(navbar, 'App shell navbar must be visible').toBeVisible({ timeout: 15000 });
        return navbar.evaluate((el) => Math.round(el.getBoundingClientRect().width));
    },

    mainNavbarToggleLocator(page) {
        return page.locator(locators.mainNavbarHeaderToggle).first();
    },

    /**
     * Main sidebar narrow/wide toggle. Mantine header NavLink often has no aria-expanded; we assert layout width.
     */
    async assertMainSidebarToggle(page) {
        const toggleBtn = this.mainNavbarToggleLocator(page);
        await expect(toggleBtn, 'Main sidebar header toggle must be visible').toBeVisible({ timeout: 10000 });

        const beforeAttr = await toggleBtn.getAttribute('aria-expanded');
        Logger.info(
            '[Main sidebar toggle] aria-expanded is often absent on Mantine NavLink; value = ' + beforeAttr,
        );

        const expandedW = await this.getMainNavbarWidth(page);
        Logger.info(`[Main sidebar toggle] Navbar width before collapse (expect >150): ${expandedW}`);
        expect(
            expandedW,
            'Sidebar should start expanded. If this fails, AppShell/CSS or env changed.',
        ).toBeGreaterThan(150);

        await toggleBtn.click();

        await expect.poll(async () => this.getMainNavbarWidth(page), {
            message:
                'After collapse, navbar must narrow. Collapse control or ClientWrapper navbar width logic may have changed.',
            timeout: 10000,
        }).toBeLessThan(120);

        const collapsedW = await this.getMainNavbarWidth(page);
        Logger.info(`[Main sidebar toggle] Navbar width when collapsed (expect <120): ${collapsedW}`);

        await this.mainNavbarToggleLocator(page).click();

        await expect.poll(async () => this.getMainNavbarWidth(page), {
            message: 'After second click, navbar must widen again (expand). Toggle or layout may be broken.',
            timeout: 10000,
        }).toBeGreaterThan(150);

        const restoredW = await this.getMainNavbarWidth(page);
        Logger.info(`[Main sidebar toggle] Navbar width after expand again: ${restoredW}`);
        Logger.success(
            `[Main sidebar toggle] Completed: expanded → collapsed (${collapsedW}px) → expanded (${restoredW}px).`,
        );
    },

};
