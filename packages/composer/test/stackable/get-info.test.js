'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { createStackableFromConfig } = require('../helper')

const pltVersion = require('../../package.json').version

test('get service info via stackable api', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

    composer: {
      services: []
    },
    plugins: {
      paths: [join(__dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')]
    }
  }

  const stackable = await createStackableFromConfig(t, config)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, {
    type: 'composer',
    version: pltVersion
  })
})
