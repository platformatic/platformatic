'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { join } = require('path')
const { loadConfiguration } = require('@platformatic/foundation')
const { version } = require('../../package.json')
const { upgrade } = require('../../lib/upgrade.js')
const { transform } = require('../../lib/config.js')

test('remove the watch config', async () => {
  const config = await loadConfiguration(join(__dirname, 'fixtures', '1.4.0.json'), null, {
    transform,
    upgrade
  })

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`)
  equal(config.watch, true)
})
