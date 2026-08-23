import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration, loadObjectConfiguration } from '../../lib/v4/index.js'
import { createTree } from './helper.js'

function collector () {
  const warnings = []
  const info = []

  return { warnings, info, onWarning: w => warnings.push(w), onInfo: i => info.push(i) }
}

async function load (cwd, overrides = {}) {
  return loadConfiguration({ cwd, command: 'dev', realEnv: {}, ...overrides })
}

test('a bare framework repository synthesizes in memory and writes nothing', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "shop", "dependencies": { "next": "15.0.0" } }',
    'app/page.tsx': ''
  })

  const report = collector()
  const { config, configPath, standalone, synthesized } = await load(root, report)

  strictEqual(configPath, null)
  strictEqual(synthesized, true)

  // standalone means no root orchestration was read; synthesis reads no configuration at all.
  strictEqual(standalone, true)

  // With the entrypoint gone, a framework application carrying no server.port would start nothing.
  deepStrictEqual(config.applications, [
    {
      id: 'shop',
      path: root,
      config: { module: '@platformatic/next', server: { port: 3042 } }
    }
  ])

  strictEqual(report.info[0].type, 'synthesized-configuration')
})

test('the synthesized port reads the resolved env map, not the ambient process.env', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "shop", "dependencies": { "vite": "5.0.0" } }',
    '.env': 'PORT=4000\n'
  })

  const { config } = await load(root)

  // Taking the ambient process.env instead would ignore a PORT sitting in the project's own .env —
  // the one file a zero-config user is most likely to have written.
  strictEqual(config.applications[0].config.server.port, 4000)
  strictEqual(config.applications[0].config.module, '@platformatic/vite')
})

test('the real environment still outranks the env file for the synthesized port', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "shop", "dependencies": { "vite": "5.0.0" } }',
    '.env': 'PORT=4000\n'
  })

  const { config } = await load(root, { realEnv: { PORT: '5000' } })

  strictEqual(config.applications[0].config.server.port, 5000)
})

test('synthesis is never refused on account of a v4 configuration above, but it says so', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [] }',
    'web/api/package.json': '{ "name": "api", "dependencies": { "@platformatic/node": "3.0.0" } }',
    'web/api/index.js': ''
  })

  const report = collector()
  const { config } = await load(join(root, 'web/api'), report)

  strictEqual(config.applications[0].config.module, '@platformatic/node')

  const [warning] = report.warnings
  strictEqual(warning.type, 'synthesized-under-ancestor')
  strictEqual(warning.legacy, false)
  ok(warning.message.includes('none of what it says'))
})

test('a v3 configuration above names the upgrade instead', async t => {
  // A v3 monorepo is exactly where a configless subpackage is most likely to be found, and
  // synthesizing there while an ancestor platformatic.json describes the application would be the
  // same silence with an older filename.
  const root = await createTree(t, {
    'platformatic.json': '{}',
    'web/api/package.json': '{ "name": "api", "dependencies": { "@platformatic/node": "3.0.0" } }',
    'web/api/index.js': ''
  })

  const report = collector()
  await load(join(root, 'web/api'), report)

  const [warning] = report.warnings
  strictEqual(warning.legacy, true)
  ok(warning.message.includes('npx wattpm-utils@4 migrate'))
})

test('synthesis reaches the root .env of the project it sits in', async t => {
  // Without resolving the env root the way a config file would, running in web/api of a monorepo
  // would synthesize an application that cannot see the root .env.
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [] }',
    '.env': 'PORT=4100\n',
    'web/api/package.json': '{ "name": "api", "dependencies": { "@platformatic/node": "3.0.0" } }',
    'web/api/index.js': ''
  })

  const { config, envRoot } = await load(join(root, 'web/api'))

  strictEqual(envRoot, root)
  strictEqual(config.applications[0].config.server.port, 4100)
})

test('a directory the detector does not recognize is an error rather than a silent boot', async t => {
  const root = await createTree(t, { 'README.md': '# nothing' })

  await rejects(() => load(root), { code: 'PLT_CAPABILITY_NOT_DETECTED' })
})

test('a programmatic object source runs the same pipeline with no import step', async t => {
  const root = await createTree(t, {
    'web/api/package.json': '{ "dependencies": { "@platformatic/service": "3.0.0" } }',
    'web/api/index.js': ''
  })

  const { config, configPath, standalone } = await loadObjectConfiguration({
    root,
    source: { applications: [{ id: 'api', path: './web/api' }] },
    command: 'start',
    realEnv: {}
  })

  strictEqual(configPath, null)
  strictEqual(standalone, false)

  // Everything downstream is unchanged: a programmatic root listing paths still gets per-app
  // discovery, per-app eval workers and the detector exactly as a file-sourced boot would.
  deepStrictEqual(config.applications[0].config, { module: '@platformatic/service' })
})

test('an object source is canonicalized before anything reads its shape', async t => {
  const root = await createTree(t, { 'index.js': '' })
  const source = { applications: [] }

  Object.defineProperty(source, 'autoload', { enumerable: true, configurable: true, get: () => ({ path: 'web' }) })

  // An embedder can hand create() an object carrying getters or a Proxy just as easily as a config
  // file can build one, and the getter must never be invoked to find out.
  await rejects(() => loadObjectConfiguration({ root, source, realEnv: {} }), error => {
    strictEqual(error.code, 'PLT_INVALID_CONFIG_VALUE')
    ok(error.message.includes('accessor'))
    return true
  })
})

test('a function-valued config in an object source is refused, naming what to do instead', async t => {
  const root = await createTree(t, { 'index.js': '' })

  await rejects(
    () =>
      loadObjectConfiguration({
        root,
        source: { applications: [{ id: 'api', path: '.', config: () => ({ module: '@platformatic/node' }) }] },
        realEnv: {}
      }),
    error => {
      strictEqual(error.code, 'PLT_INVALID_CONFIG_VALUE')
      ok(error.message.includes('/applications/0/config'))
      ok(error.message.includes('call it and pass the result'))
      return true
    }
  )
})

test('an object source without a root is refused', async () => {
  await rejects(() => loadObjectConfiguration({ source: { applications: [] } }), {
    code: 'PLT_OBJECT_SOURCE_ROOT_REQUIRED'
  })
})

test('a programmatic root floors the env walk where the embedder declared it', async t => {
  // An embedder saying create('/app', …) does not mean "and also whatever .env sits above /app".
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [] }',
    '.env': 'FROM_ABOVE=yes\nSHARED=above\n',
    'app/.env': 'SHARED=app\n',
    'app/index.js': ''
  })

  const { context } = await loadObjectConfiguration({
    root: join(root, 'app'),
    source: { application: { config: { module: '@platformatic/node' } } },
    realEnv: {}
  })

  strictEqual(context.env.SHARED, 'app')
  strictEqual(context.env.FROM_ABOVE, undefined)
})

test('the watch set covers what a reload depends on that is not an import', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { autoload: { path: "web" } }',
    'web/api/package.json': '{ "name": "api" }',
    'web/api/watt.config.js': 'export default { module: "@platformatic/service" }'
  })

  const { watchTargets } = await load(root)
  const { files, directories } = watchTargets

  // The autoload directory itself, because creating or removing an application directory changes
  // the application list.
  deepStrictEqual(directories, [join(root, 'web')])

  ok(files.includes(join(root, 'watt.config.js')))
  ok(files.includes(join(root, 'web/api/watt.config.js')))

  // The candidates that do not exist, because adding one changes which applications own a file.
  ok(files.includes(join(root, 'web/api/watt.config.ts')))

  // The package.json, which supplies the id and the dependencies the detector reads.
  ok(files.includes(join(root, 'web/api/package.json')))

  // The enumerable env-file set for every directory contributing a rung, existing or not.
  ok(files.includes(join(root, '.env')))
  ok(files.includes(join(root, '.env.development.local')))
  ok(files.includes(join(root, 'web/api/.env')))

  // The ancestor horizon, which is further up than the env root: creating one there moves the root
  // outward and makes a .env beside it live.
  ok(files.some(path => path.endsWith('watt.config.ts') && !path.startsWith(root)))
})

test('node_modules is filtered out of the watch set but not out of the import record', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'node_modules/helper/package.json': '{ "name": "helper", "type": "module", "main": "index.js" }',
    'node_modules/helper/index.js': 'export const level = "debug"',
    'watt.config.js': 'import { level } from "helper"\nexport default { applications: [], logger: { level } }'
  })

  const { watchTargets, importedFiles } = await load(root)

  ok(importedFiles.some(path => path.includes('node_modules')))
  ok(!watchTargets.files.some(path => path.includes('node_modules')))
})

test('an explicitly named env file is watched, since nothing enumerates it', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api", envfile: "./deploy.env" }] }',
    'web/api/package.json': '{ "dependencies": { "@platformatic/node": "3.0.0" } }',
    'web/api/deploy.env': 'X=1\n',
    'web/api/watt.config.js': 'export default { module: "@platformatic/node" }'
  })

  const { watchTargets } = await load(root)

  ok(watchTargets.files.includes(join(root, 'web/api/deploy.env')))

  // Mode selection does not apply to that application's own directory: the named file occupies
  // that layer, so the four mode-aware names there are not part of the set.
  ok(!watchTargets.files.includes(join(root, 'web/api/.env')))
  ok(watchTargets.files.includes(join(root, '.env')))
})

test('--env is watched and replaces the whole rung in the set as well', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js': 'export default { applications: [] }',
    'custom.env': 'X=1\n'
  })

  const { watchTargets } = await load(root, { customEnvFile: join(root, 'custom.env') })

  ok(watchTargets.files.includes(join(root, 'custom.env')))
  ok(!watchTargets.files.includes(join(root, '.env')))
})
