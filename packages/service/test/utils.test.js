'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join, resolve } = require('node:path')
const { getJSPluginPath, isFileAccessible } = require('../lib/utils')

test('should get the path of a TS plugin', (t) => {
  const result = getJSPluginPath('/something', '/something/plugin.ts', '/something/dist')
  const expected = join('/something', 'dist', 'plugin.js')
  assert.strictEqual(result, expected)
})

test('should get the path of a JS plugin', (t) => {
  const result = getJSPluginPath('/something', '/something/plugin.js', '/something/dist')
  assert.strictEqual(result, '/something/plugin.js')
})

test('isFileAccessible with dir', async (t) => {
  const dir = resolve(join(__dirname, '..', 'fixtures', 'hello'))
  assert.strictEqual(await isFileAccessible('platformatic.service.json', dir), true)
})

test('isFileAccessible no dir', async (t) => {
  const file = resolve(join(__dirname, '..', 'fixtures', 'hello', 'platformatic.service.json'))
  assert.strictEqual(await isFileAccessible(file), true)
})

test('should return the same plugin folder if it\'s already the compiled one', (t) => {
  const result = getJSPluginPath('/something', '/something/dist/plugins', '/something/dist')
  assert.strictEqual(result, '/something/dist/plugins')
})
