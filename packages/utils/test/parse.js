'use strict'

const { describe, test } = require('node:test')
const { strict: assert } = require('node:assert')
const { parseMemorySize } = require('../')

describe('parseMemorySize', () => {
  test('should parse bytes correctly', () => {
    assert.equal(parseMemorySize('1024b'), 1024)
    assert.equal(parseMemorySize('1024B'), 1024)
    assert.equal(parseMemorySize('1024 b'), 1024)
    assert.equal(parseMemorySize('1024 B'), 1024)
    assert.equal(parseMemorySize('0b'), 0)
    assert.equal(parseMemorySize('42b'), 42)
  })

  test('should parse kilobytes correctly', () => {
    assert.equal(parseMemorySize('1kb'), 1024)
    assert.equal(parseMemorySize('1KB'), 1024)
    assert.equal(parseMemorySize('1 kb'), 1024)
    assert.equal(parseMemorySize('1 KB'), 1024)
    assert.equal(parseMemorySize('1024kb'), 1048576) // 1024 * 1024
    assert.equal(parseMemorySize('0.5kb'), 512) // 0.5 * 1024
  })

  test('should parse megabytes correctly', () => {
    assert.equal(parseMemorySize('1mb'), 1048576) // 1024 * 1024
    assert.equal(parseMemorySize('1MB'), 1048576)
    assert.equal(parseMemorySize('1 mb'), 1048576)
    assert.equal(parseMemorySize('1 MB'), 1048576)
    assert.equal(parseMemorySize('1024mb'), 1073741824) // 1024 * 1024 * 1024
    assert.equal(parseMemorySize('0.5mb'), 524288) // 0.5 * 1024 * 1024
  })

  test('should parse gigabytes correctly', () => {
    assert.equal(parseMemorySize('1gb'), 1073741824) // 1024 * 1024 * 1024
    assert.equal(parseMemorySize('1GB'), 1073741824)
    assert.equal(parseMemorySize('1 gb'), 1073741824)
    assert.equal(parseMemorySize('1 GB'), 1073741824)
    assert.equal(parseMemorySize('1024gb'), 1099511627776) // 1024 * 1024 * 1024 * 1024
    assert.equal(parseMemorySize('0.5gb'), 536870912) // 0.5 * 1024 * 1024 * 1024
  })

  test('should handle decimal values correctly', () => {
    assert.equal(parseMemorySize('1.5kb'), 1536) // 1.5 * 1024
    assert.equal(parseMemorySize('2.25mb'), 2359296) // 2.25 * 1024 * 1024
    assert.equal(parseMemorySize('0.75gb'), 805306368) // 0.75 * 1024 * 1024 * 1024
    assert.equal(parseMemorySize('1.33 gb'), 1428076625) // 1.33 * 1024 * 1024 * 1024
  })

  test('should floor decimal results', () => {
    assert.equal(parseMemorySize('1.7b'), 1) // Should floor to 1
    assert.equal(parseMemorySize('1.999kb'), 2046) // 1.999 * 1024 = 2046.976, floored to 2046
  })

  test('should throw an error for invalid inputs', () => {
    const invalidCases = [
      'invalid',
      'a b',
      'kb',
      '.2 B',
      '6 FB', // Invalid unit
      '9 T',  // Invalid unit
      '1024', // No unit
      '-1kb', // Negative value
      'kb1024', // Unit before value
      '1024 kbb', // Invalid unit
      '1024k', // Incomplete unit
      '' // Empty string
    ]

    for (const input of invalidCases) {
      assert.throws(() => parseMemorySize(input), {
        name: 'Error',
        message: 'Invalid memory size'
      }, `Should throw for invalid input: "${input}"`)
    }
  })
})
