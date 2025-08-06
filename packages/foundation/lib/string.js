import leven from 'leven'

const UNITS = ['b', 'kb', 'mb', 'gb']
const UNITS_FACTOR = 1024

export function findNearestString (strings, target) {
  let nearestString = null
  let nearestDistance = Infinity

  for (const string of strings) {
    const distance = leven(string, target)
    if (distance < nearestDistance) {
      nearestString = string
      nearestDistance = distance
    }
  }
  return nearestString
}

export function match (actual, expected) {
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
export function escapeRegexp (raw) {
  return raw.replaceAll(/([!$()*+./:=?[\\\]^{|}])/g, '\\$1')
}

/**
 * Parse a memory size string and return the number of bytes
 * @param {string} size - The memory size string
 * @returns {number} The number of bytes
 * @throws {Error} If the memory size string is invalid
 * @example
 * parseMemorySize('1024') // 1024
 * parseMemorySize('1024B') // 1024
 * parseMemorySize('1024b') // 1024
 * parseMemorySize('1024KB') // 1048576
 * parseMemorySize('1024kb') // 1048576
 * parseMemorySize('1024gb') // 1099511627776
 * parseMemorySize('1024MB') // 1073741824
 * parseMemorySize('1024.2 MB') // 1073741824
 * parseMemorySize('1024GB') // 1099511627776
 * parseMemorySize('0.5 GB') // 536870912
 * parseMemorySize('1024 GB') // 1099511627776
 */
export function parseMemorySize (size) {
  const match = size.match(/^(\d+\.?\d*)\s*([A-Za-z]+)$/)
  if (!match) {
    throw new Error('Invalid memory size')
  }

  const value = parseFloat(match[1])
  const unit = match[2].toLowerCase()

  const index = UNITS.indexOf(unit)
  if (index === -1) {
    throw new Error('Invalid memory size')
  }

  return Math.floor(value * UNITS_FACTOR ** index)
}
