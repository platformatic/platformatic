'use strict'

const { test } = require('tap')
const { getJSPluginPath, isFileAccessible } = require('../lib/utils')
const { join, resolve } = require('path')

test('should get the path of a TS plugin', (t) => {
  t.plan(1)

  const result = getJSPluginPath('/something/platformatic.service.json', '/something/plugin.ts', '/something/dist')
  const expected = join('/something', 'dist', 'plugin.js')
  t.equal(result, expected)
})

test('should get the path of a JS plugin', (t) => {
  t.plan(1)

  const result = getJSPluginPath('/something/platformatic.service.json', '/something/plugin.js', '/something/dist')
  t.equal(result, '/something/plugin.js')
})

test('isFileAccessible with dir', async (t) => {
  const dir = resolve(join(__dirname, '..', 'fixtures', 'hello'))
  t.equal(await isFileAccessible('platformatic.service.json', dir), true)
})

test('isFileAccessible no dir', async (t) => {
  const file = resolve(join(__dirname, '..', 'fixtures', 'hello', 'platformatic.service.json'))
  t.equal(await isFileAccessible(file), true)
})
