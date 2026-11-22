import { createDirectory, safeRemove } from '@platformatic/foundation'
import assert from 'node:assert/strict'
import { symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createGatewayInRuntime } from './helper.js'

async function applicationIds (t, enabled, production) {
  const gateway = await createFromConfig(
    t,
    {
      server: { logger: { level: 'fatal' } },
      gateway: {
        applications: [
          { id: 'disabled', origin: 'http://disabled.example.com', enabled },
          { id: 'enabled', origin: 'http://enabled.example.com' }
        ]
      }
    },
    undefined,
    { production, skipInit: true }
  )

  const config = await gateway.getConfig()
  return config.gateway.applications.map(application => application.id)
}

test('should leave out an application its own enabled disables', async t => {
  assert.deepStrictEqual(await applicationIds(t, false, false), ['enabled'])
  assert.deepStrictEqual(await applicationIds(t, 'false', false), ['enabled'])
  assert.deepStrictEqual(await applicationIds(t, true, false), ['disabled', 'enabled'])
  assert.deepStrictEqual(await applicationIds(t, 'true', false), ['disabled', 'enabled'])
})

test('should decide enabled by environment when it is an object', async t => {
  assert.deepStrictEqual(await applicationIds(t, { production: false }, true), ['enabled'])
  assert.deepStrictEqual(await applicationIds(t, { production: false }, false), ['disabled', 'enabled'])
  assert.deepStrictEqual(await applicationIds(t, { development: false }, false), ['enabled'])
  assert.deepStrictEqual(await applicationIds(t, { staging: false }, true), ['disabled', 'enabled'])
})

async function createRuntimeWithDevelopmentOnlyApplication (t, production) {
  const echoModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/echo/node_modules')

  // Make sure there is @platformatic/node available in the echo application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await safeRemove(echoModulesRoot)
  t.after(() => safeRemove(echoModulesRoot))
  await createDirectory(resolve(echoModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(echoModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-enabled',
    {
      gateway: {
        applications: [
          { id: 'main', proxy: { prefix: '/main' } },
          { id: 'tools', proxy: { prefix: '/tools' } }
        ]
      }
    },
    [
      {
        id: 'main',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo')
      },
      {
        id: 'tools',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo'),
        enabled: { production: false }
      }
    ],
    undefined,
    undefined,
    production
  )

  return runtime.start()
}

test('should leave out an application the runtime does not run', async t => {
  const address = await createRuntimeWithDevelopmentOnlyApplication(t, true)

  const main = await request(address, { method: 'GET', path: '/main/' })
  assert.equal(main.statusCode, 200)
  assert.deepStrictEqual(await main.body.json(), { service: 'main' })

  const tools = await request(address, { method: 'GET', path: '/tools/' })
  assert.equal(tools.statusCode, 404)
  await tools.body.dump()
})

test('should proxy an application the runtime runs', async t => {
  const address = await createRuntimeWithDevelopmentOnlyApplication(t, false)

  const tools = await request(address, { method: 'GET', path: '/tools/' })
  assert.equal(tools.statusCode, 200)
  assert.deepStrictEqual(await tools.body.json(), { service: 'tools' })
})
