'use strict'

const { test } = require('node:test')
const { deepStrictEqual } = require('node:assert')
const { join } = require('path')
const { loadConfiguration } = require('@platformatic/foundation')
const { upgrade } = require('../../lib/upgrade.js')
const { transform } = require('../../lib/config.js')

test('gracefulShutdown service to application rename', async () => {
  const config = await loadConfiguration(join(__dirname, 'fixtures', '2.0.0.json'), null, {
    transform,
    upgrade
  })

  deepStrictEqual(config.gracefulShutdown, { runtime: 1000, application: 1000 })
  deepStrictEqual(config.applicationTimeout, 1234)
})
