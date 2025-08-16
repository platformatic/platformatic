import { equal, ok, strictEqual, throws } from 'node:assert'
import test from 'node:test'
import { escapeRegexp, findNearestString, match, parseMemorySize } from '../index.js'

test('findNearestString - exact match', async t => {
  const strings = ['foo', 'bar', 'baz']
  equal(findNearestString(strings, 'foo'), 'foo')
  equal(findNearestString(strings, 'bar'), 'bar')
  equal(findNearestString(strings, 'baz'), 'baz')
})

test('findNearestString - one character distance', async t => {
  const strings = ['foo', 'bar', 'baz']
  equal(findNearestString(strings, 'fo'), 'foo')
  equal(findNearestString(strings, 'ba'), 'bar')
  equal(findNearestString(strings, 'bz'), 'baz')
})

test('findNearestString - two character distance', async t => {
  const strings = ['foo', 'bar', 'baz']
  equal(findNearestString(strings, 'f'), 'foo')
  equal(findNearestString(strings, 'b'), 'bar')
  equal(findNearestString(strings, 'z'), 'baz')
})

test('findNearestString - different cases with long words', async t => {
  const strings = ['fooBarBaz', 'barBazFoo', 'bazFooBar']

  equal(findNearestString(strings, 'FooBarBaz'), 'fooBarBaz')
  equal(findNearestString(strings, 'BarBazFoo'), 'barBazFoo')
  equal(findNearestString(strings, 'BazFooBar'), 'bazFooBar')

  equal(findNearestString(strings, 'foo_bar_baz'), 'fooBarBaz')
  equal(findNearestString(strings, 'bar_baz_foo'), 'barBazFoo')
  equal(findNearestString(strings, 'baz_foo_bar'), 'bazFooBar')

  equal(findNearestString(strings, 'foo-bar-baz'), 'fooBarBaz')
  equal(findNearestString(strings, 'bar-baz-foo'), 'barBazFoo')
  equal(findNearestString(strings, 'baz-foo-bar'), 'bazFooBar')
})

test('match - simple match', async t => {
  ok(match({ a: 1, b: 2 }, { a: 1 }))
})

test('match - complex match', async t => {
  ok(match({ a: 1, b: { c: 2 }, d: {} }, { a: 1, b: { c: 2 } }))
})

test('match - complex match with null', async t => {
  ok(match({ a: 1, b: { c: 2 }, d: null }, { a: 1, b: { c: 2 } }))
})

test('match - should not match', async t => {
  equal(match({ a: 1, b: 2 }, { a: 2 }), false)
})

test('match - should not match with null', async t => {
  equal(match({ a: 1, b: null }, { a: 2 }), false)
})

test('match - should not match with undefined', async t => {
  equal(match({ a: 1, b: undefined }, { a: 2 }), false)
})

test('match - should return false for non-existing key', t => {
  const actual = { a: 1, b: 2 }
  const expected = { a: 1, b: 2, c: 3 }
  equal(match(actual, expected), false)
})

test('match - should return false for mismatching values', t => {
  equal(match({ a: 1, b: 2 }, { a: 1, c: 3 }), false)
})

test('match - match arrays', t => {
  strictEqual(match([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }]), true)
})

test('match - do not match arrays', t => {
  strictEqual(match([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 3 }]), false)
})

test('match - string pattern match fail', async t => {
  equal(match({ a: 'hello world', b: 2 }, { a: 'world.*' }), false)
})

test('match - multi-line string pattern match', async t => {
  const actual = `
    function example() {
      console.log('Hello, world!');
      return true;
    }
  `
  const expected = `
    console.log('Hello, world!');
    return true;
  `
  ok(match(actual, expected))
})

test('match - multi-line string pattern match fail', async t => {
  const actual = `
    function example() {
      console.log('Hello, world!');
      return false;
    }
  `
  const expected = `
    console.log('Goodbye, world!');
    return true;
  `
  equal(match(actual, expected), false)
})

test('parseMemorySize- should parse bytes correctly', () => {
  equal(parseMemorySize('1024b'), 1024)
  equal(parseMemorySize('1024B'), 1024)
  equal(parseMemorySize('1024 b'), 1024)
  equal(parseMemorySize('1024 B'), 1024)
  equal(parseMemorySize('0b'), 0)
  equal(parseMemorySize('42b'), 42)
})

test('parseMemorySize- should parse kilobytes correctly', () => {
  equal(parseMemorySize('1kb'), 1024)
  equal(parseMemorySize('1KB'), 1024)
  equal(parseMemorySize('1 kb'), 1024)
  equal(parseMemorySize('1 KB'), 1024)
  equal(parseMemorySize('1024kb'), 1048576) // 1024 * 1024
  equal(parseMemorySize('0.5kb'), 512) // 0.5 * 1024
})

test('parseMemorySize- should parse megabytes correctly', () => {
  equal(parseMemorySize('1mb'), 1048576) // 1024 * 1024
  equal(parseMemorySize('1MB'), 1048576)
  equal(parseMemorySize('1 mb'), 1048576)
  equal(parseMemorySize('1 MB'), 1048576)
  equal(parseMemorySize('1024mb'), 1073741824) // 1024 * 1024 * 1024
  equal(parseMemorySize('0.5mb'), 524288) // 0.5 * 1024 * 1024
})

test('parseMemorySize- should parse gigabytes correctly', () => {
  equal(parseMemorySize('1gb'), 1073741824) // 1024 * 1024 * 1024
  equal(parseMemorySize('1GB'), 1073741824)
  equal(parseMemorySize('1 gb'), 1073741824)
  equal(parseMemorySize('1 GB'), 1073741824)
  equal(parseMemorySize('1024gb'), 1099511627776) // 1024 * 1024 * 1024 * 1024
  equal(parseMemorySize('0.5gb'), 536870912) // 0.5 * 1024 * 1024 * 1024
})

test('parseMemorySize- should handle decimal values correctly', () => {
  equal(parseMemorySize('1.5kb'), 1536) // 1.5 * 1024
  equal(parseMemorySize('2.25mb'), 2359296) // 2.25 * 1024 * 1024
  equal(parseMemorySize('0.75gb'), 805306368) // 0.75 * 1024 * 1024 * 1024
  equal(parseMemorySize('1.33 gb'), 1428076625) // 1.33 * 1024 * 1024 * 1024
})

test('parseMemorySize- should floor decimal results', () => {
  equal(parseMemorySize('1.7b'), 1) // Should floor to 1
  equal(parseMemorySize('1.999kb'), 2046) // 1.999 * 1024 = 2046.976, floored to 2046
})

test('parseMemorySize- should throw an error for invalid inputs', async () => {
  const invalidCases = [
    'invalid',
    'a b',
    'kb',
    '.2 B',
    '6 FB', // Invalid unit
    '9 T', // Invalid unit
    '1024', // No unit
    '-1kb', // Negative value
    'kb1024', // Unit before value
    '1024 kbb', // Invalid unit
    '1024k', // Incomplete unit
    '' // Empty string
  ]

  for (const input of invalidCases) {
    await throws(
      () => parseMemorySize(input),
      {
        name: 'Error',
        message: 'Invalid memory size'
      },
      `Should throw for invalid input: "${input}"`
    )
  }
})

test('escapeRegexp - should escape special regex characters', () => {
  equal(escapeRegexp('hello.world'), 'hello\\.world')
  equal(escapeRegexp('test*pattern'), 'test\\*pattern')
  equal(escapeRegexp('query?string'), 'query\\?string')
  equal(escapeRegexp('path/to/file'), 'path\\/to\\/file')
  equal(escapeRegexp('price$100'), 'price\\$100')
  equal(escapeRegexp('start^end'), 'start\\^end')
  equal(escapeRegexp('array[0]'), 'array\\[0\\]')
  equal(escapeRegexp('object{key}'), 'object\\{key\\}')
  equal(escapeRegexp('group(1)'), 'group\\(1\\)')
  equal(escapeRegexp('plus+sign'), 'plus\\+sign')
  equal(escapeRegexp('pipe|or'), 'pipe\\|or')
  equal(escapeRegexp('backslash\\'), 'backslash\\\\')
  equal(escapeRegexp('exclamation!'), 'exclamation\\!')
  equal(escapeRegexp('equals=sign'), 'equals\\=sign')
  equal(escapeRegexp('colon:value'), 'colon\\:value')
})

test('escapeRegexp - should handle empty string', () => {
  equal(escapeRegexp(''), '')
})

test('escapeRegexp - should handle string with no special characters', () => {
  equal(escapeRegexp('hello world'), 'hello world')
  equal(escapeRegexp('abc123'), 'abc123')
})
