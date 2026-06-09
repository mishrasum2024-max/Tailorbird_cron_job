/**
 * Consistent failure messages when visible copy, roles, or URLs drift.
 * Keeps assertions readable and logs a single line before hard expects when debugging.
 */
const { Logger } = require('./logger');

/**
 * @param {string} layer - e.g. "CTA label", "URL", "validation banner"
 * @param {string} expected - human-readable expected value or description
 * @param {string} [hint] - optional extra context
 */
function driftMessage(layer, expected, hint) {
  const tail =
    hint ||
    'Compare with live app (MCP browser). Update fixture or locator if product intentionally changed.';
  return `FAIL: ${layer} — expected ${expected}. ${tail}`;
}

/**
 * @param {string} context - e.g. step id
 * @param {string} message
 */
function logExpectation(context, message) {
  if (process.env.LOG_LEVEL === 'debug') {
    Logger.info(`[${context}] Expect: ${message}`);
  }
}

module.exports = { driftMessage, logExpectation };
