import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { normalizeOn404 } from '../index.js'

const code = 200
const type = 'text/html'
const path = 'index.html'

test('on404 is nullish', t => {
  deepStrictEqual(normalizeOn404(undefined), { enabled: false, code, type, path })
  deepStrictEqual(normalizeOn404(null), { enabled: false, code, type, path })
})

test('on404 is boolean', t => {
  deepStrictEqual(normalizeOn404(false), { enabled: false, code, type, path })
  deepStrictEqual(normalizeOn404(true), { enabled: true, code, type, path })
})

test('on404 is string', t => {
  deepStrictEqual(normalizeOn404('oops.html'), { enabled: true, code, type, path: 'oops.html' })
  deepStrictEqual(normalizeOn404(''), { enabled: false, code, type, path })
})

test('on404 is object', t => {
  deepStrictEqual(normalizeOn404({}), { enabled: false, code, type, path })
  deepStrictEqual(normalizeOn404({ enabled: true }), { enabled: true, code, type, path })
  deepStrictEqual(normalizeOn404({ path: 'oops.html' }), { enabled: true, code, type, path: 'oops.html' })
  deepStrictEqual(normalizeOn404({ enabled: false, path: 'test.html' }), { enabled: false, code, type, path: 'test.html' })
  deepStrictEqual(normalizeOn404({ enabled: true, path: 'test.html' }), { enabled: true, code, type, path: 'test.html' })
  deepStrictEqual(normalizeOn404({ enabled: true, code: 404, path: 'test.html' }), { enabled: true, code: 404, type, path: 'test.html' })
  deepStrictEqual(normalizeOn404({ enabled: true, type: 'application/json', path: 'test.json' }), { enabled: true, code, type: 'application/json', path: 'test.json' })
})
