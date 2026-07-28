import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { upgrade } from '../../lib/upgrade.js'

test('migrates the root entrypoint and server to the exposed application', async () => {
  const config = {
    entrypoint: 'main',
    server: { port: 3042 },
    applications: [
      {
        id: 'main'
      },
      {
        id: 'internal'
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
        exposed: true,
        server: { port: 3042 }
      },
      {
        id: 'internal',
        exposed: false
      }
    ],
    custom: {
      entrypoint: 'nested',
      server: { port: 3044 }
    }
  })
})

test('preserves the root entrypoint and server for autoloaded applications', async () => {
  const config = {
    entrypoint: 'main',
    server: { port: 3042 },
    autoload: { path: './web' }
  }

  deepStrictEqual(await upgrade(null, config, '3.0.0'), {
    applications: [
      {
        id: 'main',
        path: './web/main',
        exposed: true,
        server: { port: 3042 }
      }
    ],
    autoload: { path: './web' }
  })
})

test('removes root entrypoint and server when no applications are configured', async () => {
  const config = {
    entrypoint: 'main',
    server: { port: 3042 }
  }

  deepStrictEqual(await upgrade(null, config, '3.0.0'), {})
})
