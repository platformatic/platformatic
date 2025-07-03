'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { configManagerConfig } = require('../../index.js')
const { upgrade } = require('../../lib/upgrade.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('change $schema location', async () => {
  const source = {
    $schema: 'https://platformatic.dev/schemas/v1.52.0/composer',
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'info'
      }
    },
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:3051',
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:3052',
          openapi: {
            url: '/documentation/json',
            prefix: '/api2'
          }
        }
      ],
      refreshTimeout: 1000
    },
    watch: false
  }

  const configManager = new ConfigManager({
    ...configManagerConfig,
    upgrade,
    source,
    version,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/composer/${version}.json`)
})
