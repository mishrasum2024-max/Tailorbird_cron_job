/**
 * UI Inspector - Scans page for interactive elements and logs their state
 * Purpose: Capture complete snapshot of all CTAs, buttons, inputs for debugging
 * and detecting UI changes/drift
 */

const { InteractionLogger } = require('./InteractionLogger');

class UIInspector {
  /**
   * Scan all interactive elements on page and log them
   * @param {import('@playwright/test').Page} page
   * @param {string} [stepContext] - optional context like "login-email-step"
   */
  static async scanAndLogInteractiveElements(page, stepContext = '') {
    try {
      const elements = await page.evaluate(() => {
        const result = [];

        // Buttons
        document.querySelectorAll('button').forEach((btn) => {
          result.push({
            type: 'button',
            text: btn.textContent?.trim() || btn.getAttribute('aria-label') || '[no text]',
            visible: btn.offsetHeight > 0,
            disabled: btn.disabled,
            selector: btn.id ? `#${btn.id}` : btn.className ? `.${btn.className.split(' ')[0]}` : '',
            ariaLabel: btn.getAttribute('aria-label'),
            name: btn.getAttribute('name'),
          });
        });

        // Inputs
        document.querySelectorAll('input').forEach((inp) => {
          result.push({
            type: 'input',
            text: inp.placeholder || inp.getAttribute('aria-label') || inp.name || '[input]',
            visible: inp.offsetHeight > 0,
            inputType: inp.type,
            disabled: inp.disabled,
            value: inp.type === 'password' ? '[password field]' : inp.value,
            selector: inp.id ? `#${inp.id}` : inp.name ? `[name="${inp.name}"]` : '',
            required: inp.required,
          });
        });

        // Links
        document.querySelectorAll('a').forEach((link) => {
          result.push({
            type: 'link',
            text: link.textContent?.trim() || '[link]',
            visible: link.offsetHeight > 0,
            href: link.href,
            selector: link.id ? `#${link.id}` : '',
          });
        });

        // Form labels (often indicate required fields)
        document.querySelectorAll('label').forEach((lbl) => {
          result.push({
            type: 'label',
            text: lbl.textContent?.trim(),
            visible: lbl.offsetHeight > 0,
          });
        });

        return result;
      });

      const contextStr = stepContext ? ` [${stepContext}]` : '';
      InteractionLogger.logPageScan(elements);

      // Log visibility summary
      const visible = elements.filter((e) => e.visible).length;
      const total = elements.length;
      InteractionLogger.logCheckpoint(`UI Scan Complete${contextStr}`, `${visible}/${total} elements visible`);

      return elements;
    } catch (error) {
      InteractionLogger.logStepFailure('UI Scan', error.message, 'Check page structure');
      return [];
    }
  }

  /**
   * Capture all text content from interactive elements (useful for detecting copy changes)
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<object>} { buttonTexts, inputLabels, linkTexts, labels }
   */
  static async captureAllText(page) {
    const allText = await page.evaluate(() => {
      return {
        buttonTexts: [...document.querySelectorAll('button')].map(
          (b) => b.textContent?.trim() || b.getAttribute('aria-label')
        ).filter(Boolean),
        inputLabels: [...document.querySelectorAll('input')].map(
          (i) => i.placeholder || i.getAttribute('aria-label') || i.name || ''
        ).filter(Boolean),
        linkTexts: [...document.querySelectorAll('a')].map(
          (l) => l.textContent?.trim()
        ).filter(Boolean),
        labels: [...document.querySelectorAll('label')].map(
          (l) => l.textContent?.trim()
        ).filter(Boolean),
      };
    });

    return allText;
  }

  /**
   * Assert all expected texts are present on page (catches copy drift)
   * @param {import('@playwright/test').Page} page
   * @param {object} expectedTexts - { buttons: [], inputs: [], links: [], labels: [] }
   * @param {string} context - context for logging
   * @returns {Promise<boolean>} true if all match
   */
  static async assertTextsMatch(page, expectedTexts, context = '') {
    const actual = await this.captureAllText(page);
    let allMatch = true;

    // Check buttons
    if (expectedTexts.buttons) {
      for (const expectedText of expectedTexts.buttons) {
        const found = actual.buttonTexts.includes(expectedText);
        if (!found) {
          allMatch = false;
          InteractionLogger.logUIDrift('Button CTA', expectedText, actual.buttonTexts.join(', '), false);
        }
      }
    }

    // Check input labels/placeholders
    if (expectedTexts.inputs) {
      for (const expectedLabel of expectedTexts.inputs) {
        const found = actual.inputLabels.includes(expectedLabel);
        if (!found) {
          allMatch = false;
          InteractionLogger.logUIDrift('Input Label', expectedLabel, actual.inputLabels.join(', '), false);
        }
      }
    }

    // Check links
    if (expectedTexts.links) {
      for (const expectedLink of expectedTexts.links) {
        const found = actual.linkTexts.includes(expectedLink);
        if (!found) {
          allMatch = false;
          InteractionLogger.logUIDrift('Link Text', expectedLink, actual.linkTexts.join(', '), false);
        }
      }
    }

    if (allMatch) {
      InteractionLogger.logUIDrift('All Text Elements', 'Match expected', 'Match expected', true);
    }

    return allMatch;
  }

  /**
   * Get specific button text for logging
   * @param {import('@playwright/test').Page} page
   * @param {string} selector - CSS selector or button text
   * @returns {Promise<string>} the button text
   */
  static async getButtonText(page, selector) {
    try {
      const text = await page.locator(`button:has-text("${selector}")`).textContent();
      return text?.trim() || selector;
    } catch {
      return selector;
    }
  }

  /**
   * Get all visible error messages on page
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<string[]>}
   */
  static async captureErrorMessages(page) {
    const errors = await page.evaluate(() => {
      const result = [];
      // Look for common error containers
      document.querySelectorAll('[role="alert"], .error, .form-error, .validation-error, [class*="error"]').forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length > 0 && text.length < 500) {
          result.push(text);
        }
      });
      return result;
    });

    return [...new Set(errors)]; // Remove duplicates
  }

  /**
   * Capture form state (which fields are visible, required, filled, etc.)
   * @param {import('@playwright/test').Page} page
   * @returns {Promise<object>}
   */
  static async captureFormState(page) {
    const formState = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea, select');
      const fields = [];

      inputs.forEach((input) => {
        fields.push({
          name: input.name || input.id,
          type: input.type,
          placeholder: input.placeholder,
          value: input.type === 'password' ? '[password]' : input.value,
          visible: input.offsetHeight > 0,
          disabled: input.disabled,
          required: input.required,
          filled: input.value?.length > 0,
        });
      });

      return fields;
    });

    return formState;
  }

  /**
   * Log form state for debugging
   * @param {import('@playwright/test').Page} page
   * @param {string} context
   */
  static async logFormState(page, context = '') {
    const formState = await this.captureFormState(page);
    const ctxStr = context ? ` [${context}]` : '';
    InteractionLogger.logCheckpoint(`Form State${ctxStr}`, `${formState.length} fields found`);
    
    formState.forEach((field) => {
      const filled = field.filled ? '✓' : '○';
      const required = field.required ? '⚠️' : '';
      const visible = field.visible ? '👁️' : '❌';
      InteractionLogger.logElementAttributes(
        `${field.name || field.type}`,
        { filled, required, visible, type: field.type, placeholder: field.placeholder }
      );
    });
  }

  /**
   * Wait for element and log its visibility
   * @param {import('@playwright/test').Page} page
   * @param {string} selector
   * @param {string} label - human-readable label for logs
   * @param {number} timeout
   * @returns {Promise<boolean>}
   */
  static async waitForElementAndLog(page, selector, label, timeout = 10000) {
    try {
      await page.locator(selector).waitFor({ state: 'visible', timeout });
      InteractionLogger.logVisibility(label, true, timeout);
      return true;
    } catch {
      InteractionLogger.logVisibility(label, false, timeout);
      return false;
    }
  }

  /**
   * Capture element's computed styles and attributes (useful for debugging visual issues)
   * @param {import('@playwright/test').Page} page
   * @param {string} selector
   * @returns {Promise<object>}
   */
  static async captureElementDetails(page, selector) {
    const details = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;

      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);

      return {
        text: el.textContent?.trim(),
        visible: rect.height > 0 && rect.width > 0,
        position: { x: rect.x, y: rect.y },
        size: { width: rect.width, height: rect.height },
        display: computed.display,
        visibility: computed.visibility,
        disabled: el.disabled || false,
        ariaLabel: el.getAttribute('aria-label'),
        ariaHidden: el.getAttribute('aria-hidden'),
        role: el.getAttribute('role'),
        title: el.getAttribute('title'),
      };
    }, selector);

    return details;
  }

  /**
   * Log detailed element info
   * @param {import('@playwright/test').Page} page
   * @param {string} selector
   * @param {string} label
   */
  static async logElementDetails(page, selector, label) {
    const details = await this.captureElementDetails(page, selector);
    if (!details) {
      InteractionLogger.logStepFailure('Element Capture', `Element not found: ${selector}`);
      return;
    }

    InteractionLogger.logCheckpoint(`Element Details: ${label}`);
    InteractionLogger.logElementAttributes(label, details);
  }

  /**
   * Take full DOM snapshot and log summary
   * @param {import('@playwright/test').Page} page
   * @param {string} context
   * @returns {Promise<string>} HTML snapshot
   */
  static async captureDOMSnapshot(page, context = '') {
    const html = await page.content();
    const ctxStr = context ? ` [${context}]` : '';
    InteractionLogger.logCheckpoint(`DOM Snapshot Captured${ctxStr}`, `${html.length} characters`);
    return html;
  }

  /**
   * Look for expected navigation and log result
   * @param {import('@playwright/test').Page} page
   * @param {string|RegExp} expectedUrl
   * @param {string} context
   * @param {number} timeout
   * @returns {Promise<boolean>}
   */
  static async assertNavigationAndLog(page, expectedUrl, context = '', timeout = 15000) {
    try {
      await page.waitForURL(expectedUrl, { timeout });
      const actualUrl = page.url();
      InteractionLogger.logUrlAssertion(
        expectedUrl instanceof RegExp ? expectedUrl.source : expectedUrl,
        actualUrl,
        true
      );
      return true;
    } catch (error) {
      const actualUrl = page.url();
      InteractionLogger.logUrlAssertion(
        expectedUrl instanceof RegExp ? expectedUrl.source : expectedUrl,
        actualUrl,
        false
      );
      return false;
    }
  }
}

module.exports = { UIInspector };
