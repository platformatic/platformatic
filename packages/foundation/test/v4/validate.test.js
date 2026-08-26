import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  createCapabilityValidator,
  importCapabilitySchema,
  loadConfiguration,
  validateCapabilityConfiguration
} from '../../lib/v4/index.js'
import { createTree } from './helper.js'

const capabilitySchema = {
  type: 'object',
  properties: {
    server: { type: 'object', properties: { port: { type: 'number', default: 3042 } }, default: {} },
    main: { type: 'string', resolvePath: true },
    plugin: { type: 'string', resolveModule: true },
    empty: { type: 'string', resolvePath: true, allowEmptyPaths: true },
    handler: { typeof: 'string' }
  },
  additionalProperties: false
}

// A capability package as it appears on disk, with the light subpath the v4 contract requires.
// servesWithoutPortSource is emitted verbatim: the declaration is allowed to be a callable, and a
// JSON-encoded one would be a string that only looks like a function.
function capabilityPackage (name, version, { subpath = true, servesWithoutPort, servesWithoutPortSource } = {}) {
  const exported = `export const schema = ${JSON.stringify(capabilitySchema)}
export const version = '${version}'
export const skipTelemetryHooks = true
export const modulesToLoad = ['thing']
${servesWithoutPortSource ? `export const servesWithoutPort = ${servesWithoutPortSource}` : servesWithoutPort ? `export const servesWithoutPort = ${JSON.stringify(servesWithoutPort)}` : ''}
`

  const files = {
    [`node_modules/${name}/package.json`]: JSON.stringify({
      name,
      version,
      type: 'module',
      main: 'index.js',
      exports: subpath ? { '.': './index.js', './schema': './schema.js' } : { '.': './index.js' }
    }),
    [`node_modules/${name}/index.js`]: subpath ? 'export const capability = true\n' : exported
  }

  if (subpath) {
    files[`node_modules/${name}/schema.js`] = exported
  }

  return files
}

test('the schema is imported through the light subpath, application-scoped first', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...capabilityPackage('@acme/capability', '4.0.0', { servesWithoutPort: 'always' })
  })

  const imported = await importCapabilitySchema('@acme/capability', root)

  strictEqual(imported.scope, 'application')
  strictEqual(imported.via, 'subpath')

  // The subpath carries the package-level metadata main-side preparation needs besides the schema.
  deepStrictEqual(imported.metadata, {
    skipTelemetryHooks: true,
    modulesToLoad: ['thing'],
    servesWithoutPort: 'always'
  })
})

test('an absent servesWithoutPort means worker, which never produces the error', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...capabilityPackage('@acme/capability', '4.0.0')
  })

  const imported = await importCapabilitySchema('@acme/capability', root)

  strictEqual(imported.metadata.servesWithoutPort, 'worker')
})

test('a capability without the subpath falls back to its entry, and says so', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...capabilityPackage('@acme/legacy', '4.0.0', { subpath: false })
  })

  const imported = await importCapabilitySchema('@acme/legacy', root)

  strictEqual(imported.via, 'entry')
})

test('a capability whose schema cannot be imported is an error, not a skipped check', async t => {
  // A validator that skips what it cannot import is not a validator.
  const root = await createTree(t, { 'package.json': '{ "name": "app" }' })

  await rejects(() => importCapabilitySchema('@acme/missing', root), {
    code: 'PLT_CAPABILITY_SCHEMA_NOT_FOUND'
  })
})

test('validation reports every failure by path', () => {
  throws(
    () => validateCapabilityConfiguration({ notAnOption: true }, capabilitySchema, {
      id: 'api',
      module: '@acme/capability',
      root: '/app'
    }),
    error => {
      strictEqual(error.code, 'PLT_INVALID_APPLICATION_CONFIGURATION')
      ok(error.message.includes('api'))
      ok(error.message.includes('@acme/capability'))
      deepStrictEqual(error.validationErrors[0].path, '/')
      return true
    }
  )
})

test('an unknown option is named, not merely counted', () => {
  // AJV puts the property in params rather than in the message, so the commonest mistake of all —
  // a typo in an option name — would otherwise read as "must NOT have additional properties" and
  // leave the author to find which one.
  throws(
    () =>
      validateCapabilityConfiguration({ serverr: {} }, capabilitySchema, {
        id: 'api',
        module: '@acme/capability',
        root: '/app'
      }),
    error => {
      ok(error.message.includes("'serverr'"), error.message)
      return true
    }
  )
})

test('useDefaults runs here rather than in the eval worker', () => {
  // Which is what keeps the resolve projection carrying authored values rather than
  // schema-supplied ones.
  const config = {}

  validateCapabilityConfiguration(config, capabilitySchema, { id: 'api', module: '@acme/capability', root: '/app' })

  deepStrictEqual(config, { server: { port: 3042 } })
})

test('coercion is off, so a stringly number is a failure rather than a silent conversion', () => {
  throws(
    () =>
      validateCapabilityConfiguration({ server: { port: '3042' } }, capabilitySchema, {
        id: 'api',
        module: '@acme/capability',
        root: '/app'
      }),
    { code: 'PLT_INVALID_APPLICATION_CONFIGURATION' }
  )
})

test('resolvePath resolves against the application root, not the runtime root', () => {
  const config = { main: './server.js' }
  const root = resolve('/app', 'web/api')

  validateCapabilityConfiguration(config, capabilitySchema, { id: 'api', module: '@acme/capability', root })

  strictEqual(config.main, resolve(root, './server.js'))
})

test('allowEmptyPaths is what decides whether an empty path is legal', () => {
  const permitted = { empty: '' }
  validateCapabilityConfiguration(permitted, capabilitySchema, { id: 'api', module: '@acme/x', root: '/app' })
  strictEqual(permitted.empty, '')

  throws(() => validateCapabilityConfiguration({ main: '' }, capabilitySchema, { id: 'api', module: '@acme/x', root: '/app' }), {
    code: 'PLT_INVALID_APPLICATION_CONFIGURATION'
  })
})

test('resolveModule resolves against the application root and fails when it cannot', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "app" }',
    ...capabilityPackage('@acme/plugin', '1.0.0')
  })

  const config = { plugin: '@acme/plugin' }
  validateCapabilityConfiguration(config, capabilitySchema, { id: 'api', module: '@acme/x', root })
  ok(config.plugin.includes(join('@acme', 'plugin')))

  throws(
    () => validateCapabilityConfiguration({ plugin: '@acme/absent' }, capabilitySchema, { id: 'api', module: '@acme/x', root }),
    { code: 'PLT_INVALID_APPLICATION_CONFIGURATION' }
  )
})

test('fixPaths off leaves the authored value in place', () => {
  const validator = createCapabilityValidator(capabilitySchema, { root: '/app', fixPaths: false })
  const config = { main: './server.js' }

  ok(validator(config))
  strictEqual(config.main, './server.js')
})

test('the typeof keyword reports the property it failed on', () => {
  throws(
    () => validateCapabilityConfiguration({ handler: 42 }, capabilitySchema, { id: 'api', module: '@acme/x', root: '/app' }),
    error => {
      ok(error.message.includes('handler'))
      return true
    }
  )
})

test('the loader validates each application payload when asked to', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: "./web/api", config: { module: "@acme/capability", server: { port: 8080 } } }] }',
    ...capabilityPackage('@acme/capability', '4.0.0'),
    'web/api/index.js': ''
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  deepStrictEqual(config.applications[0].config, { server: { port: 8080 } })

  // The serving declaration is not here: it is evaluated main-side and can be a function, and this
  // entry is structured-cloned into the worker.
  deepStrictEqual(config.applications[0].capabilityMetadata, {
    skipTelemetryHooks: true,
    modulesToLoad: ['thing']
  })
})

test('an application entry survives the structured clone that hands it to a worker', async t => {
  // A capability whose servesWithoutPort is callable -- vite's is -- put a function on the entry,
  // and the runtime got a DataCloneError from new Worker rather than anything naming the cause.
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    ...capabilityPackage('@acme/capability', '4.0.0', { servesWithoutPortSource: 'config => ({ development: false, production: true })' }),
    'web/api/watt.config.js': 'export default { module: "@acme/capability", server: { port: 8080 } }'
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  structuredClone(config.applications[0])
})

test('a typo in a capability option fails the load rather than reaching the worker', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: "./web/api", config: { module: "@acme/capability", serverr: {} } }] }',
    ...capabilityPackage('@acme/capability', '4.0.0'),
    'web/api/index.js': ''
  })

  await rejects(
    () => loadConfiguration({ cwd: root, command: 'start', realEnv: {} }),
    error => {
      strictEqual(error.code, 'PLT_INVALID_APPLICATION_CONFIGURATION')
      ok(error.message.includes('api'))
      return true
    }
  )
})

test('a detected entry is validated too, so an unresolvable capability fails the load', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    ...capabilityPackage('@acme/capability', '4.0.0'),
    'web/api/package.json': '{ "dependencies": { "@platformatic/node": "3.0.0" } }'
  })

  // The detector answers @platformatic/node here, which has no schema resolvable from this tree —
  // so the check fails loudly rather than passing an unvalidated payload downstream.
  await rejects(() => loadConfiguration({ cwd: root, command: 'start', realEnv: {} }), {
    code: 'PLT_CAPABILITY_SCHEMA_NOT_FOUND'
  })
})

test('validation is on by default, so an unresolvable capability fails the load', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: "./web/api", config: { module: "@acme/absent", serverr: {} } }] }',
    'web/api/index.js': ''
  })

  await rejects(() => loadConfiguration({ cwd: root, command: 'start', realEnv: {} }), {
    code: 'PLT_CAPABILITY_SCHEMA_NOT_FOUND'
  })
})

test('opting out is explicit, and then nothing half-runs', async t => {
  // The escape hatch exists for callers that genuinely have no capability to resolve — the loader's
  // own tests for scope and the env ladder among them — and it turns the whole check off rather
  // than degrading it, so there is no state where a payload is partly validated.
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: "./web/api", config: { module: "@acme/absent", serverr: {} } }] }',
    'web/api/index.js': ''
  })

  const { config } = await loadConfiguration({
    cwd: root,
    command: 'start',
    realEnv: {},
    validateCapabilities: false
  })

  deepStrictEqual(config.applications[0].config, { serverr: {} })
  strictEqual(config.applications[0].capabilityMetadata, undefined)
})
