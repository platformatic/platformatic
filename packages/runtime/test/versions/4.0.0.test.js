import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { upgrade } from '../../lib/upgrade.js'

test('remove only the root entrypoint and server', async () => {
  const config = {
    entrypoint: 'main',
    server: { port: 3042 },
    applications: [
      {
        id: 'main',
        entrypoint: true
      }
    ],
    custom: {
      entrypoint: 'nested',
      server: { port: 3044 }
    }
  }

  deepStrictEqual(await upgrade(null, config, '3.0.0'), {
    applications: [
      {
        id: 'main',
        entrypoint: true
      }
    ],
    custom: {
      entrypoint: 'nested',
      server: { port: 3044 }
    }
  })
})
