'use strict'

const assert = require('node:assert/strict')
const { join } = require('node:path')
const { test } = require('node:test')
const { Store } = require('../')
const { ConfigManager } = require('../lib/manager')

test('stackable update', async t => {
  const cwd = process.cwd()
  process.chdir(join(__dirname, 'fixtures', 'stackable-upgrade'))

  const store = new Store()

  t.after(() => {
    process.chdir(cwd)
  })

  const res = await store.loadConfig()
  assert.equal(res.configManager instanceof ConfigManager, true, 'should return configManager')
  assert.equal(res.app.name, 'foo', 'should return app')
  await res.configManager.parseAndValidate()
  assert.deepStrictEqual(res.configManager.current, {
    $schema: './stackable.schema.json',
    module: './foo.js@0.42.0',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: ['./plugin.js']
    },
    originalVersion: '0.42.0' // see foo.js
  })
})
