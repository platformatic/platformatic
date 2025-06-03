const UNITS = ['b', 'kb', 'mb', 'gb']
const UNITS_FACTOR = 1024

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
function parseMemorySize (size) {
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

  const bytes = value * (UNITS_FACTOR ** index)
  if (isNaN(bytes)) {
    throw new Error('Invalid memory size')
  }

  return Math.floor(bytes)
}

module.exports = { parseMemorySize }
