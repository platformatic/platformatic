import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { normalizeOn404 } from '../index.js'

test('on404 is nullish', t => {
  deepStrictEqual(normalizeOn404(undefined), { enabled: false, path: 'index.html' })
  deepStrictEqual(normalizeOn404(null), { enabled: false, path: 'index.html' })
})

test('on404 is boolean', t => {
  deepStrictEqual(normalizeOn404(false), { enabled: false, path: 'index.html' })
  deepStrictEqual(normalizeOn404(true), { enabled: true, path: 'index.html' })
})

test('on404 is string', t => {
  deepStrictEqual(normalizeOn404('oops.html'), { enabled: true, path: 'oops.html' })
  deepStrictEqual(normalizeOn404(''), { enabled: false, path: 'index.html' })
})

test('on404 is object', t => {
  deepStrictEqual(normalizeOn404({}), { enabled: false, path: 'index.html' })
  deepStrictEqual(normalizeOn404({ enabled: true }), { enabled: true, path: 'index.html' })
  deepStrictEqual(normalizeOn404({ path: 'oops.html' }), { enabled: true, path: 'oops.html' })
  deepStrictEqual(normalizeOn404({ enabled: false, path: 'test.html' }), { enabled: false, path: 'test.html' })
  deepStrictEqual(normalizeOn404({ enabled: true, path: 'test.html' }), { enabled: true, path: 'test.html' })
})
