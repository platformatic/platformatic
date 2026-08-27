import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadAdditionalApplications, loadConfiguration } from '../../lib/v4/index.js'
import { createTree } from './helper.js'

function collector () {
  const warnings = []
  const info = []

  return {
    warnings,
    info,
    onWarning: warning => warnings.push(warning),
    onInfo: entry => info.push(entry)
  }
}

async function load (cwd, overrides = {}) {
  // These fixtures name capabilities that are not installed beside them, and they are exercising
  // scope, the env ladder, the watch set and the detector rather than capability validation, which
  // validate.test.js covers on its own fixtures.
  return loadConfiguration({ cwd, command: 'start', realEnv: {}, validateCapabilities: false, ...overrides })
}

test('a root config boots the full runtime and evaluates each per-app file in its own worker', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }, { id: "web", path: "./web/frontend" }] }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service", from: process.env.WHO }',
    'web/api/.env': 'WHO=api\n',
    'web/frontend/watt.config.js': 'export default { module: "@platformatic/next", from: process.env.WHO }',
    'web/frontend/.env': 'WHO=frontend\n'
  })

  const { config, standalone, configPath } = await load(root)

  strictEqual(standalone, false)
  strictEqual(configPath, join(root, 'watt.config.js'))

  // Per-worker cache isolation is what makes cross-app contamination impossible: each file reads
  // its own directory's env.
  // module is stripped into the entry envelope, so the payload the capability validates carries
  // no reserved properties and its schema keeps additionalProperties: false.
  deepStrictEqual(config.applications.map(entry => [entry.module, entry.config]), [
    ['@platformatic/service', { from: 'api' }],
    ['@platformatic/next', { from: 'frontend' }]
  ])
})

test('an application directory boots standalone, and says what is not applied', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/package.json': '{ "name": "@acme/api" }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }'
  })

  const report = collector()
  const { config, standalone, configPath, root: decidedRoot } = await load(join(root, 'web/api'), report)

  strictEqual(standalone, true)
  strictEqual(decidedRoot, join(root, 'web/api'))

  // A configured id lives on a root entry, which a standalone boot never reads: the derivation is
  // identical in both boots, the inputs are not.
  // The entry carries no configPath of its own: the deciding file is the application's own file,
  // so auto-wrap made it an inline config and the path is reported at the top level.
  strictEqual(configPath, join(root, 'web/api/watt.config.js'))
  deepStrictEqual(config.applications, [
    { id: 'api', path: join(root, 'web/api'), module: '@platformatic/service', config: {} }
  ])

  const [warning] = report.warnings
  strictEqual(warning.type, 'standalone-boot')
  ok(warning.message.includes('http://*.plt.local'))
})

test('the canonical single-app project prints no standalone warning', async t => {
  // Level 1 is a bare factory call, which classifies as an app-def; without the ancestor half of
  // the condition it would announce missing siblings to a project that has none.
  const root = await createTree(t, {
    'package.json': '{ "name": "solo" }',
    'watt.config.js': 'export default { module: "@platformatic/node" }'
  })

  const report = collector()
  const { standalone } = await load(root, report)

  strictEqual(standalone, true)
  deepStrictEqual(report.warnings, [])
})

test('an entry with no file and no inline config is resolved by the detector', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/package.json': '{ "dependencies": { "next": "15.0.0" } }'
  })

  const report = collector()
  const { config } = await load(root, report)

  strictEqual(config.applications[0].module, '@platformatic/next')
  deepStrictEqual(config.applications[0].config, {})
  strictEqual(config.applications[0].detected, true)

  /*
    Boot logs one line per detected application, so the inference is never invisible. Selected
    rather than indexed: the info stream carries the boot-scope announcement too, and a test that
    depends on the order of diagnostics breaks every time one is added.
  */
  const detection = report.info.find(info => info.type === 'detected-capability')

  strictEqual(detection?.message, 'api → @platformatic/next (detected)')
})

test('a capability dependency wins over an unrelated framework dependency', async t => {
  // The inversion of v3: under the old order, a generated Node application that later added Vite
  // as unrelated tooling would silently switch capability on its next boot.
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/package.json': '{ "dependencies": { "@platformatic/node": "3.0.0", "vite": "5.0.0" } }'
  })

  const { config } = await load(root)

  strictEqual(config.applications[0].module, '@platformatic/node')
})

test('two capability dependencies are an actionable ambiguity error naming both', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/package.json': '{ "dependencies": { "@platformatic/node": "3.0.0", "@platformatic/db": "3.0.0" } }'
  })

  await rejects(() => load(root), error => {
    strictEqual(error.code, 'PLT_AMBIGUOUS_CAPABILITY')
    ok(error.message.includes('@platformatic/db, @platformatic/node'))
    return true
  })
})

test('a companion package does not trip the ambiguity error', async t => {
  // The table is enumerated rather than pattern-matched on @platformatic/*, so @platformatic/globals
  // — which @platformatic/node's own generator writes alongside it — has no vote.
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/package.json': '{ "dependencies": { "@platformatic/node": "3.0.0", "@platformatic/globals": "3.0.0" } }'
  })

  const { config } = await load(root)

  strictEqual(config.applications[0].module, '@platformatic/node')
})

test('composer is an alias of gateway rather than a second capability', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/package.json': '{ "dependencies": { "@platformatic/composer": "2.0.0", "@platformatic/gateway": "3.0.0" } }'
  })

  const { config } = await load(root)

  strictEqual(config.applications[0].module, '@platformatic/gateway')
})

test('a directory with nothing to go on is an error naming the application', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/README.md': '# nothing here'
  })

  await rejects(() => load(root), error => {
    strictEqual(error.code, 'PLT_CAPABILITY_NOT_DETECTED')
    ok(error.message.includes('api'))
    return true
  })
})

test('an inline config alongside a per-app file is the configured-twice error', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: "./web/api", config: { module: "@platformatic/node" } }] }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }'
  })

  await rejects(() => load(root), error => {
    strictEqual(error.code, 'PLT_APPLICATION_CONFIGURED_TWICE')
    ok(error.message.includes('api'))
    return true
  })
})

test('the deciding file is exempt from the configured-twice check', async t => {
  // defineConfig({ application: { workers: 2 } }) in a bare repository has a defaulted path and no
  // inline config; without the exemption it would discover its own root config.
  const root = await createTree(t, {
    'package.json': '{ "name": "solo", "dependencies": { "@platformatic/node": "3.0.0" } }',
    'watt.config.js': 'export default { application: { workers: 2 } }'
  })

  const { config } = await load(root)

  deepStrictEqual(config.applications, [
    { workers: 2, path: root, id: 'solo', module: '@platformatic/node', config: {}, detected: true }
  ])
})

test('a per-app worker cannot read a topology variable an env file supplies', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }, { id: "web", path: "./web/frontend" }] }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }',
    'web/frontend/watt.config.js':
      'export default { module: "@platformatic/next", sibling: process.env.PLT_API_URL ?? "stripped", unrelated: process.env.PLT_STRIPE_URL }',
    'web/frontend/.env': 'PLT_API_URL=http://stale.example\nPLT_STRIPE_URL=http://stripe.example\n'
  })

  const { config } = await load(root)

  // Leaving the name in place would let the file's stale value be baked into resolvedConfig, where
  // runtime injection can no longer reach it. The match is by exact key, not prefix and suffix.
  deepStrictEqual(config.applications[1].config, {
    sibling: 'stripped',
    unrelated: 'http://stripe.example'
  })
})

test('a topology variable already in the real environment is not stripped', async t => {
  // A key already present in the runtime's own real environment is one injection skips, so the
  // worker genuinely uses the inherited value and stripping would make the two views disagree.
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }, { id: "web", path: "./web/frontend" }] }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }',
    'web/frontend/watt.config.js':
      'export default { module: "@platformatic/next", sibling: process.env.PLT_API_URL ?? "stripped" }'
  })

  const { config } = await load(root, { realEnv: { PLT_API_URL: 'http://inherited.example' } })

  strictEqual(config.applications[1].config.sibling, 'http://inherited.example')
})

test('a per-app file that classifies as a root config names the application', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/watt.config.js': 'export default { applications: [] }'
  })

  await rejects(() => load(root), error => {
    strictEqual(error.code, 'PLT_ROOT_CONFIGURATION_IN_APPLICATION_ENTRY')
    ok(error.message.includes('api'))
    return true
  })
})

test('an envfile is refused on an inline config and on the deciding directory, for different reasons', async t => {
  const inline = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: "./web/api", envfile: "./deploy.env", config: { module: "@platformatic/node" } }] }',
    'web/api/deploy.env': ''
  })

  await rejects(() => load(inline), { code: 'PLT_ENV_FILE_ON_INLINE_CONFIG' })

  const deciding = await createTree(t, {
    'package.json': '{ "name": "solo", "dependencies": { "@platformatic/node": "3.0.0" } }',
    'watt.config.js': 'export default { application: { workers: 2, envfile: "deploy.env" } }',
    'deploy.env': ''
  })

  await rejects(() => load(deciding), { code: 'PLT_ENV_FILE_ON_DECIDING_DIRECTORY' })
})

test('an entry resolved by the detector may declare an envfile', async t => {
  // Nothing is evaluated for it, so there is no evaluation view for the envfile to be absent from,
  // and the governs-both-views promise is satisfied by there being one view.
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: "./web/api", envfile: "./deploy.env" }] }',
    'web/api/package.json': '{ "dependencies": { "@platformatic/node": "3.0.0" } }',
    'web/api/deploy.env': 'X=1\n'
  })

  const { config } = await load(root)

  strictEqual(config.applications[0].module, '@platformatic/node')
})

test('an id that cannot be a DNS label is refused rather than sanitized', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "my_app", path: "." }] }'
  })

  await rejects(() => load(root), { code: 'PLT_INVALID_APPLICATION_ID' })
})

test('two ids normalizing to one topology variable are refused before either consumer sees them', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api-v2", path: "." }, { id: "API-v2", path: "." }] }'
  })

  await rejects(() => load(root), error => {
    strictEqual(error.code, 'PLT_INVALID_APPLICATION_ID')
    ok(error.message.includes('PLT_API_V2_URL'))
    return true
  })
})

test('the watched set unions every worker import graph and every declared read', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'import "./shared.js"\nexport default ctx => { ctx.addWatchFile("./ports.json"); return { applications: [{ id: "api", path: "./web/api" }] } }',
    'shared.js': 'export const nothing = 1',
    'ports.json': '{}',
    'web/api/watt.config.js': 'import "./local.js"\nexport default { module: "@platformatic/service" }',
    'web/api/local.js': 'export const nothing = 1'
  })

  const { importedFiles, watchedFiles } = await load(root)

  ok(importedFiles.includes(join(root, 'shared.js')))
  ok(importedFiles.includes(join(root, 'web/api/local.js')))
  deepStrictEqual(watchedFiles, [join(root, 'ports.json')])
})

test('--config names the configuration and takes cwd out of the decision', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/package.json': '{ "dependencies": { "@platformatic/node": "3.0.0" } }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }'
  })

  // Standing in the application, but naming the root configuration: the runtime boots.
  const { standalone, config } = await load(join(root, 'web/api'), { configPath: join(root, 'watt.config.js') })

  strictEqual(standalone, false)
  strictEqual(config.applications[0].module, '@platformatic/service')
})

test('an application added after boot is evaluated the way boot evaluates one', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }',
    'web/later/watt.config.js': 'export default { module: "@platformatic/service", from: process.env.WHO }',
    'web/later/.env': 'WHO=later\n'
  })

  const { applications } = await loadAdditionalApplications({
    configPath: join(root, 'watt.config.js'),
    entries: [{ id: 'later', path: './web/later' }],
    existingIds: ['api'],
    realEnv: {},
    validateCapabilities: false
  })

  strictEqual(applications.length, 1)

  // The evaluated payload is what the worker receives instead of a file path: an entry that
  // reached the worker without it would be told to find a configuration v4 never wrote.
  const [added] = applications
  strictEqual(added.module, '@platformatic/service')
  deepStrictEqual(added.config, { from: 'later' })

  // The application it was added beside is addressable from it, which is the whole point of
  // passing the running topology in rather than only the batch.
  strictEqual(added.workerEnv.PLT_API_URL, 'http://api.plt.local')
  strictEqual(added.workerEnv.PLT_LATER_URL, 'http://later.plt.local')
})

test('an added application whose id collides with a running one is refused', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }',
    'web/other/watt.config.js': 'export default { module: "@platformatic/service" }'
  })

  // Case is the interesting half: DNS labels are case-insensitive, so API and api are one mesh
  // hostname and one injected variable.
  await rejects(
    loadAdditionalApplications({
      configPath: join(root, 'watt.config.js'),
      entries: [{ id: 'API', path: './web/other' }],
      existingIds: ['api'],
      realEnv: {},
      validateCapabilities: false
    }),
    /normalizing/
  )
})
