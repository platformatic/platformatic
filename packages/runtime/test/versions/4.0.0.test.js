import { deepStrictEqual, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { upgrade } from '../../lib/upgrade.js'

function createLogger (warnings) {
  return {
    child () {
      return this
    },
    info () {},
    warn (message) {
      warnings.push(message)
    }
  }
}

test('removes root and application server configuration', async () => {
  const warnings = []
  const config = {
    entrypoint: 'main',
    server: { port: 3042 },
    applications: [{ id: 'main', server: { port: 3043 } }, { id: 'internal' }],
    services: [{ id: 'service', server: { port: 3045 } }],
    web: [{ id: 'web', server: { port: 3046 } }],
    custom: {
      entrypoint: 'nested',
      server: { port: 3044 }
    }
  }

  deepStrictEqual(await upgrade(createLogger(warnings), config, '3.0.0'), {
    applications: [{ id: 'main' }, { id: 'internal' }],
    services: [{ id: 'service' }],
    web: [{ id: 'web' }],
    custom: {
      entrypoint: 'nested',
      server: { port: 3044 }
    }
  })
  strictEqual(warnings.length, 1)
  strictEqual(
    warnings[0],
    'Runtime v4 no longer supports a root server configuration. Move it into the configuration of the capability that owns the listener.'
  )
})

test('removes server configuration from autoload mappings without creating an application', async () => {
  const config = {
    entrypoint: 'main',
    server: { port: 3042 },
    autoload: {
      path: './web',
      mappings: {
        main: { id: 'main', server: { port: 3042 } }
      }
    }
  }

  deepStrictEqual(await upgrade(null, config, '3.0.0'), {
    autoload: {
      path: './web',
      mappings: {
        main: { id: 'main' }
      }
    }
  })
})

test('recognizes legacy Runtime schema URLs', async () => {
  const config = {
    $schema: 'https://platformatic.dev/schemas/v2.0.0/runtime',
    entrypoint: 'main',
    server: { port: 0 },
    applications: [{ id: 'main' }]
  }

  deepStrictEqual(await upgrade(null, config, '3.0.0'), {
    $schema: 'https://platformatic.dev/schemas/v2.0.0/runtime',
    applications: [{ id: 'main' }]
  })
})

test('preserves capability-owned server configuration for standalone applications', async () => {
  const warnings = []
  const config = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/next/3.0.0.json',
    server: { hostname: '127.0.0.1', port: 0 },
    application: { outputDirectory: 'dist' }
  }

  deepStrictEqual(await upgrade(createLogger(warnings), config, '3.0.0'), config)
  deepStrictEqual(warnings, [])
})

test('does not warn when no root server is configured', async () => {
  const warnings = []
  const config = { entrypoint: 'main', applications: [{ id: 'main' }] }

  deepStrictEqual(await upgrade(createLogger(warnings), config, '3.0.0'), {
    applications: [{ id: 'main' }]
  })
  deepStrictEqual(warnings, [])
})
