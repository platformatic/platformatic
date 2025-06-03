'use strict'

function match (actual, expected) {
  if (typeof actual === 'string' && typeof expected === 'string') {
    const patterns = expected
      .trim()
      .split(/\r?\n/)
      .map(s => s.trim())

    let lastIndex = -1
    for (const pattern of patterns) {
      const index = actual.indexOf(pattern)
      if (index === -1 || index < lastIndex) {
        return false
      }
      lastIndex = index
    }
    return true
  }

  for (const key in expected) {
    if (key in actual) {
      if (typeof expected[key] === 'object' && expected[key] !== null) {
        /* c8 ignore next 3 */
        if (!match(actual[key], expected[key])) {
          return false
        }
      } else {
        if (actual[key] !== expected[key]) {
          return false
        }
      }
    } else {
      return false
    }
  }
  return true
}

// Once we drop Node < 24, remove this in favor of Regexp.escape which is more accurate
function escapeRegexp (raw) {
  return raw.replaceAll(/([!$()*+./:=?[\\\]^{|}])/g, '\\$1')
}

module.exports = { match, escapeRegexp }
