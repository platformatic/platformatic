'use strict'

const { test } = require('tap')
const { getJSPluginPath, findConfigFile, isFileAccessible } = require('../lib/utils')
const { join, resolve } = require('path')

test('should get the path of a JS plugin', (t) => {
  t.plan(1)

  const result = getJSPluginPath('/something/platformatic.service.json', '/something/plugin.ts', '/something/dist')
  const expected = join('/something', 'dist', 'plugin.js')
  t.equal(result, expected)
})

test('findConfigFile', async (t) => {
  const result = await findConfigFile(join(__dirname, '..', 'fixtures', 'hello'), [
    'platformatic.service.json'
  ])
  t.equal(result, 'platformatic.service.json')
})

test('findConfigFile / failure', async (t) => {
  const result = await findConfigFile(join(__dirname, '..', 'fixtures', 'hello'), [
    'foobar'
  ])
  t.equal(result, undefined)
})

test('isFileAccessible no dir', async (t) => {
  const file = resolve(join(__dirname, '..', 'fixtures', 'hello', 'platformatic.service.json'))
  t.equal(await isFileAccessible(file), true)
})
