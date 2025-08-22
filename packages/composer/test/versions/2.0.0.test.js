import { loadConfiguration } from '@platformatic/foundation'
import { transform } from '@platformatic/service'
import { equal } from 'node:assert'
import test from 'node:test'
import { version } from '../../lib/schema.js'
import { upgrade } from '../../lib/upgrade.js'

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
      applications: [
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

  const config = await loadConfiguration(source, null, {
    root: import.meta.dirname,
    transform,
    upgrade
  })

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/composer/${version}.json`)
})
