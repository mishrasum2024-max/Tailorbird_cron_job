/**
 * Advanced Interaction Logger - Captures everything about interactions
 * Logs: element text, state, attributes, actions, and assertions
 * Purpose: Make automation logs humanified and complete for debugging
 */

const { Logger } = require('./logger');

class InteractionLogger {
  /**
   * Log when visiting/navigating to a page
   * @param {string} url
   * @param {string} expectedTitle - what we expect the page title to be
   */
  static logNavigation(url, expectedTitle) {
    Logger.info(`🌐 Navigating to: ${url}`);
    if (expectedTitle) {
      Logger.info(`   Expected page: "${expectedTitle}"`);
    }
  }

  /**
   * Log page title verification
   * @param {string} actual
   * @param {string} expected
   * @param {boolean} passed
   */
  static logPageTitleAssertion(actual, expected, passed) {
    const status = passed ? '✅' : '❌';
    Logger.info(
      `${status} Page Title Assert: Expected "${expected}" | Actual "${actual}" | ${passed ? 'PASS' : 'FAIL'}`
    );
  }

  /**
   * Log when we're about to interact with an element
   * @param {string} actionType - 'click', 'fill', 'select', 'hover', etc.
   * @param {string} elementLabel - human-readable element label
   * @param {string} elementText - the visible text on the element
   * @param {object} details - optional extra details
   */
  static logInteraction(actionType, elementLabel, elementText, details = {}) {
    const formattedAction = actionType.toUpperCase();
    const detailsStr = Object.keys(details).length > 0 
      ? ` | ${JSON.stringify(details)}`
      : '';
    
    Logger.info(`🔘 [${formattedAction}] ${elementLabel}`);
    if (elementText) {
      Logger.info(`   └─ Text: "${elementText}"`);
    }
    if (detailsStr) {
      Logger.info(`   └─ Details:${detailsStr}`);
    }
  }

  /**
   * Log element visibility state
   * @param {string} elementLabel
   * @param {boolean} isVisible
   * @param {number} timeout
   */
  static logVisibility(elementLabel, isVisible, timeout = null) {
    const status = isVisible ? '👁️ ' : '❌ ';
    const timeoutStr = timeout ? ` (waited ${timeout}ms)` : '';
    Logger.info(`${status}Element visible: ${elementLabel}${timeoutStr} — ${isVisible ? 'YES' : 'NOT FOUND'}`);
  }

  /**
   * Log form field fill action with before/after capture
   * @param {string} fieldLabel
   * @param {string} value - the value being filled (sanitize if sensitive)
   * @param {boolean} isPassword - if true, mask the value in logs
   */
  static logFormFill(fieldLabel, value, isPassword = false) {
    const displayValue = isPassword ? '••••••••' : value;
    Logger.info(`📝 [FILL] ${fieldLabel}: "${displayValue}"`);
  }

  /**
   * Log button click with CTA text
   * @param {string} buttonLabel
   * @param {string} ctaText - the actual text on the button (CTA)
   */
  static logButtonClick(buttonLabel, ctaText) {
    Logger.info(`🖱️ [CLICK] ${buttonLabel}`);
    if (ctaText) {
      Logger.info(`   └─ CTA: "${ctaText}"`);
    }
  }

  /**
   * Log assertion with expected vs actual
   * @param {string} assertionType - e.g., 'URL', 'Text', 'Visibility', 'Attribute'
   * @param {string} description
   * @param {string} expected
   * @param {string} actual
   * @param {boolean} passed
   */
  static logAssertion(assertionType, description, expected, actual, passed) {
    const status = passed ? '✅' : '❌';
    const passStr = passed ? 'PASS' : 'FAIL';
    Logger.info(
      `${status} [ASSERT: ${assertionType}] ${description}`
    );
    Logger.info(`   Expected: "${expected}"`);
    Logger.info(`   Actual:   "${actual}"`);
    Logger.info(`   Status:   ${passStr}`);
  }

  /**
   * Log URL change / navigation expectation
   * @param {string} expected - expected URL or URL pattern
   * @param {string} actual - actual URL
   * @param {boolean} passed
   */
  static logUrlAssertion(expected, actual, passed) {
    this.logAssertion('URL', 'Page URL after action', expected, actual, passed);
  }

  /**
   * Log error message visibility
   * @param {string} errorText
   * @param {boolean} found
   * @param {string} context - e.g., step name
   */
  static logErrorMessage(errorText, found, context = '') {
    const status = found ? '⚠️ ' : '✅ ';
    const ctxStr = context ? ` [${context}]` : '';
    Logger.info(`${status}Error message captured${ctxStr}: "${errorText}"`);
  }

  /**
   * Log successful completion of a step
   * @param {string} stepName
   * @param {string} detail - optional extra detail
   */
  static logStepComplete(stepName, detail = '') {
    const detailStr = detail ? ` — ${detail}` : '';
    Logger.success(`✓ Step Complete: ${stepName}${detailStr}`);
  }

  /**
   * Log step failure with reason
   * @param {string} stepName
   * @param {string} reason
   * @param {string} suggestion - how to fix
   */
  static logStepFailure(stepName, reason, suggestion = '') {
    Logger.error(`✗ Step Failed: ${stepName}`);
    Logger.error(`  Reason: ${reason}`);
    if (suggestion) {
      Logger.error(`  Suggestion: ${suggestion}`);
    }
  }

  /**
   * Log wait action with timeout
   * @param {string} waitingFor
   * @param {number} timeoutMs
   * @param {boolean} completed
   */
  static logWait(waitingFor, timeoutMs, completed = true) {
    const status = completed ? '⏱️ ' : '⏳ ';
    Logger.info(`${status}Waiting for: ${waitingFor} (${timeoutMs}ms) — ${completed ? 'DONE' : 'PENDING'}`);
  }

  /**
   * Log validation error - form validation, field-level errors
   * @param {string} fieldName
   * @param {string} validationMessage
   */
  static logValidationError(fieldName, validationMessage) {
    Logger.error(`❌ Validation Error: ${fieldName}`);
    Logger.error(`   Message: "${validationMessage}"`);
  }

  /**
   * Log element attribute capture
   * @param {string} elementLabel
   * @param {object} attributes - { attrName: value }
   */
  static logElementAttributes(elementLabel, attributes) {
    Logger.info(`🏷️ [ATTRIBUTES] ${elementLabel}`);
    Object.entries(attributes).forEach(([key, value]) => {
      Logger.info(`   ├─ ${key}: "${value}"`);
    });
  }

  /**
   * Log a checkpoint/milestone
   * @param {string} milestone
   * @param {string} detail
   */
  static logCheckpoint(milestone, detail = '') {
    const detailStr = detail ? ` — ${detail}` : '';
    Logger.success(`🎯 Checkpoint: ${milestone}${detailStr}`);
  }

  /**
   * Log comparison of captured vs expected values (for detecting UI drift)
   * @param {string} componentName
   * @param {string|array} expectedValues
   * @param {string|array} actualValues
   * @param {boolean} matches
   */
  static logUIDrift(componentName, expectedValues, actualValues, matches) {
    const status = matches ? '✅' : '⚠️ ';
    Logger.info(`${status} [UI DRIFT CHECK] ${componentName}`);
    
    const expArr = Array.isArray(expectedValues) ? expectedValues : [expectedValues];
    const actArr = Array.isArray(actualValues) ? actualValues : [actualValues];
    
    if (matches) {
      Logger.info(`   ✓ No drift detected`);
    } else {
      Logger.error(`   ✗ DRIFT DETECTED`);
      Logger.error(`   Expected: ${JSON.stringify(expArr)}`);
      Logger.error(`   Actual:   ${JSON.stringify(actArr)}`);
    }
  }

  /**
   * Log multi-step interaction
   * @param {string} stepNumber - e.g., '1', '2a', '3b'
   * @param {string} action - what we're doing
   * @param {string} detail - extra context
   */
  static logMultiStep(stepNumber, action, detail = '') {
    const detailStr = detail ? ` — ${detail}` : '';
    Logger.info(`📍 Step ${stepNumber}: ${action}${detailStr}`);
  }

  /**
   * Log a scanned/discovered element (useful for debugging locators)
   * @param {string} elementType - 'button', 'input', 'link', etc.
   * @param {string} text
   * @param {object} attributes - optional attributes like aria-label, id, etc.
   */
  static logDiscoveredElement(elementType, text, attributes = {}) {
    Logger.info(`🔍 Found <${elementType}> "${text}"`);
    if (Object.keys(attributes).length > 0) {
      Object.entries(attributes).forEach(([key, value]) => {
        Logger.info(`   ├─ ${key}: ${value}`);
      });
    }
  }

  /**
   * Log a summary of all interactive elements on page (for debugging)
   * @param {array} elements - array of { type, text, selector }
   */
  static logPageScan(elements) {
    Logger.info(`📊 [PAGE SCAN] Found ${elements.length} interactive elements:`);
    elements.forEach((el, idx) => {
      Logger.info(`   [${idx + 1}] <${el.type}> "${el.text}" ${el.selector ? `(${el.selector})` : ''}`);
    });
  }

  /**
   * Log auth-specific message (used for AuthKit messages)
   * @param {string} messageType - 'error', 'success', 'info'
   * @param {string} text
   * @param {string} context - e.g., 'email-step', 'password-step'
   */
  static logAuthMessage(messageType, text, context = '') {
    const icon = {
      'error': '❌',
      'success': '✅',
      'info': 'ℹ️'
    }[messageType] || 'ℹ️';
    
    const ctxStr = context ? ` [${context}]` : '';
    Logger.info(`${icon} [AUTH${ctxStr}] ${text}`);
  }

  /**
   * Log session storage or state capture
   * @param {string} stateName - e.g., 'sessionState', 'authToken'
   * @param {boolean} stored
   * @param {string} location - e.g., 'sessionState.json'
   */
  static logStateStorage(stateName, stored, location = '') {
    const status = stored ? '💾' : '❌';
    const locStr = location ? ` → ${location}` : '';
    Logger.success(`${status} State saved: ${stateName}${locStr}`);
  }
}

module.exports = { InteractionLogger };
