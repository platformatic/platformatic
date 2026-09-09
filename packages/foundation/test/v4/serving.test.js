import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import {
  assertApplicationServes,
  evaluateServesWithoutPort,
  loadConfiguration,
  willApplicationServe
} from '../../lib/v4/index.js'
import { createTree } from './helper.js'

// The matrix, as each capability's own start path behaves with no port and no command. It is
// written out in full because a partial one is what produced the error this table replaces.
const matrix = [
  { capabilities: ['service', 'db', 'gateway'], declaration: { development: true, production: true }, dev: 'serves', start: 'serves' },
  { capabilities: ['astro', 'remix', 'nest', 'react-router'], declaration: { development: false, production: true }, dev: 'fails', start: 'serves' },
  { capabilities: ['next', 'nitro', 'nuxt', 'tanstack'], declaration: { development: false, production: false }, dev: 'fails', start: 'fails' },
  { capabilities: ['node'], declaration: 'worker', dev: 'serves', start: 'serves' }
]

test('the matrix decides each row in both modes, with no port and no command', () => {
  for (const { capabilities, declaration, dev, start } of matrix) {
    for (const capability of capabilities) {
      const inDevelopment = willApplicationServe({ declaration, config: {}, production: false })
      const inProduction = willApplicationServe({ declaration, config: {}, production: true })

      strictEqual(inDevelopment.serves, dev === 'serves', `${capability} under dev`)
      strictEqual(inProduction.serves, start === 'serves', `${capability} under start`)
    }
  }
})

test('vite has two answers because the package has two capability classes', () => {
  // create() selects ViteSSRCapability when SSR is enabled and ViteCapability otherwise, and
  // ViteSSRCapability extends NodeCapability — so an SSR application inherits Node's uncertainty.
  const declaration = config => {
    const ssr = config?.vite?.ssr
    return ssr === true || ssr?.enabled ? 'worker' : { development: false, production: true }
  }

  strictEqual(evaluateServesWithoutPort(declaration, { vite: {} }).development, false)
  strictEqual(evaluateServesWithoutPort(declaration, { vite: {} }).production, true)
  strictEqual(evaluateServesWithoutPort(declaration, { vite: { ssr: { enabled: true } } }), 'worker')
})

test('the boolean ssr shorthand is a supported spelling and must classify the same way', async () => {
  // The schema admits ssr as a boolean or an object, and only the worker-side transform normalizes
  // the boolean. Testing ssr?.enabled alone reads undefined here and classifies an SSR application
  // as ordinary Vite: rejecting a valid in-process SSR factory under dev, and promising mesh
  // availability under start for a module that may report no server.
  const { servesWithoutPort } = await import('../../../vite/schema.js')

  strictEqual(evaluateServesWithoutPort(servesWithoutPort, { vite: { ssr: true } }), 'worker')
  strictEqual(evaluateServesWithoutPort(servesWithoutPort, { vite: { ssr: { enabled: true } } }), 'worker')
  deepStrictEqual(evaluateServesWithoutPort(servesWithoutPort, { vite: { ssr: false } }), {
    development: false,
    production: true
  })
  deepStrictEqual(evaluateServesWithoutPort(servesWithoutPort, { vite: {} }), {
    development: false,
    production: true
  })
})

test('every shipped capability declares the row the matrix gives it', async () => {
  const expected = {
    service: { development: true, production: true },
    db: { development: true, production: true },
    gateway: { development: true, production: true },
    astro: { development: false, production: true },
    remix: { development: false, production: true },
    nest: { development: false, production: true },
    'react-router': { development: false, production: true },
    next: { development: false, production: false },
    nitro: { development: false, production: false },
    nuxt: { development: false, production: false },
    tanstack: { development: false, production: false },
    node: 'worker'
  }

  for (const [capability, row] of Object.entries(expected)) {
    const { servesWithoutPort } = await import(`../../../${capability}/schema.js`)

    deepStrictEqual(servesWithoutPort, row, capability)
  }
})

test('absent means worker, not false', () => {
  // The two wrong answers are opposite: false rejects at load a capability that would have served
  // the mesh perfectly well, and true prints a mesh URL that answers nothing.
  strictEqual(evaluateServesWithoutPort(undefined, {}), 'worker')
  strictEqual(willApplicationServe({ declaration: undefined, config: {}, production: false }).serves, true)
})

test('a defined port serves whatever the capability declares', () => {
  const declaration = { development: false, production: false }
  const config = { server: { port: 3042 } }

  strictEqual(willApplicationServe({ declaration, config, production: false }).reason, 'port')
  strictEqual(willApplicationServe({ declaration, config, production: true }).reason, 'port')

  // Port 0 is a request for an ephemeral port, not an absent one.
  strictEqual(willApplicationServe({ declaration, config: { server: { port: 0 } }, production: true }).serves, true)
})

test('a custom command for the mode this boot uses is the third way to serve', () => {
  // Every framework capability checks its command before the port, so a framework application with
  // a custom command and no server.port is valid and starts.
  const declaration = { development: false, production: false }
  const config = { application: { commands: { development: 'npm run dev' } } }

  strictEqual(willApplicationServe({ declaration, config, production: false }).reason, 'command')

  // Neither start path falls back to the other's key, so an application declaring only a
  // development command and booted with start has no command and no port.
  strictEqual(willApplicationServe({ declaration, config, production: true }).serves, false)
})

test('an application that would start nothing fails the load, naming it and its capability', () => {
  throws(
    () =>
      assertApplicationServes({
        id: 'frontend',
        module: '@platformatic/next',
        declaration: { development: false, production: false },
        config: {},
        production: false
      }),
    error => {
      strictEqual(error.code, 'PLT_APPLICATION_STARTS_NOTHING')
      ok(error.message.includes('frontend'))
      ok(error.message.includes('@platformatic/next'))
      ok(error.message.includes('development'))
      return true
    }
  )
})

test('worker-classified rows are exempt in both modes, which is what the classification means', () => {
  // Reading "framework capability under dev" as covering Vite SSR would reject exactly the
  // configuration the matrix exists to admit.
  for (const production of [false, true]) {
    strictEqual(assertApplicationServes({
      id: 'ssr',
      module: '@platformatic/vite',
      declaration: () => 'worker',
      config: { vite: { ssr: true } },
      production
    }).reason, 'worker-classified')

    strictEqual(assertApplicationServes({
      id: 'worker',
      module: '@platformatic/node',
      declaration: 'worker',
      config: {},
      production
    }).reason, 'worker-classified')
  }
})

test('a production framework application never reaches the error', () => {
  // That boot has an in-thread application to dispatch to; the mode is part of the predicate's
  // input, not a detail of it.
  for (const capability of ['astro', 'remix', 'nest', 'react-router']) {
    strictEqual(
      assertApplicationServes({
        id: capability,
        module: `@platformatic/${capability}`,
        declaration: { development: false, production: true },
        config: {},
        production: true
      }).reason,
      'serves-without-port'
    )
  }
})

// A capability that starts nothing without a port, as next, nitro, nuxt and tanstack do.
function inactiveCapability (name) {
  return {
    [`node_modules/${name}/package.json`]: JSON.stringify({
      name,
      version: '4.0.0',
      type: 'module',
      exports: { '.': './index.js', './schema': './schema.js', './*': './*' }
    }),
    [`node_modules/${name}/index.js`]: 'export const capability = true\n',
    [`node_modules/${name}/schema.js`]: `export const schema = { type: 'object', properties: { server: { type: 'object' }, application: { type: 'object' } }, additionalProperties: false }
export const servesWithoutPort = { development: false, production: false }
`
  }
}

test('the loader refuses an application that would start nothing', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "frontend", path: "./web/frontend", config: { module: "@acme/inactive" } }] }',
    ...inactiveCapability('@acme/inactive'),
    'web/frontend/index.js': ''
  })

  // Fail fast, rather than booting a runtime with one application silently missing.
  await rejects(() => loadConfiguration({ cwd: root, command: 'start', realEnv: {} }), {
    code: 'PLT_APPLICATION_STARTS_NOTHING'
  })
})

test('the same application loads once it has a port, and reports why it serves', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "frontend", path: "./web/frontend", config: { module: "@acme/inactive", server: { port: 3042 } } }] }',
    ...inactiveCapability('@acme/inactive'),
    'web/frontend/index.js': ''
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  deepStrictEqual(config.applications[0].serving, { serves: true, reason: 'port' })
})

test('a custom command for this mode is enough, and the other mode is not', async t => {
  const files = {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "frontend", path: "./web/frontend", config: { module: "@acme/inactive", application: { commands: { development: "npm run dev" } } } }] }',
    ...inactiveCapability('@acme/inactive'),
    'web/frontend/index.js': ''
  }

  const forDev = await createTree(t, files)
  const { config } = await loadConfiguration({ cwd: forDev, command: 'dev', realEnv: {} })
  deepStrictEqual(config.applications[0].serving, { serves: true, reason: 'command' })

  const forStart = await createTree(t, files)
  await rejects(() => loadConfiguration({ cwd: forStart, command: 'start', realEnv: {} }), {
    code: 'PLT_APPLICATION_STARTS_NOTHING'
  })
})
