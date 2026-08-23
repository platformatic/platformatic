import { loadConfiguration } from '@platformatic/foundation/lib/v4/index.js'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { safeRemove } from '@platformatic/foundation'

/*
  The end-to-end shape: a real watt.config.ts, authored with defineConfig and the capability
  factories, evaluated by the v4 loader.

  The fixtures live under this package's test directory so that a bare '@platformatic/node' import
  resolves through the workspace the way it does in a real project. wattpm itself is not
  self-linked here, so defineConfig is imported by path; in a published project it is the bare
  'wattpm' specifier, which is why the package entry is kept light.
*/
const wattpmEntry = pathToFileURL(resolve(import.meta.dirname, '../index.js')).href

async function createProject (t, files) {
  const root = await mkdtemp(join(import.meta.dirname, 'tmp-v4-'))

  t.after(() => safeRemove(root))

  for (const [path, contents] of Object.entries(files)) {
    const target = resolve(root, path)

    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, 'utf-8')
  }

  return root
}

test('a Level 1 file is a bare factory call, auto-wrapped into a single-application runtime', async t => {
  const root = await createProject(t, {
    'package.json': JSON.stringify({ name: 'shop', type: 'module' }),
    'watt.config.ts': `
      import { node } from '@platformatic/node'

      export default node({ main: './server.js', server: { port: 3042 } })
    `,
    'server.js': 'export function create () {}'
  })

  const { config, standalone } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  strictEqual(standalone, true)
  strictEqual(config.applications.length, 1)

  const [entry] = config.applications
  strictEqual(entry.id, 'shop')
  strictEqual(entry.path, root)

  // The capability block is flattened in the authored form and nested in the result; the shared
  // server block keeps its v3 position.
  // module and version are stripped into the entry envelope, so the payload the capability
  // validates carries no reserved properties.
  strictEqual(entry.module, '@platformatic/node')
  ok(entry.definitionVersion)
  deepStrictEqual(entry.config.node, { main: './server.js' })
  deepStrictEqual(entry.config.server, { port: 3042 })
  strictEqual(entry.config.module, undefined)
})

test('a Level 1b file uses defineConfig with the singular application shorthand', async t => {
  const root = await createProject(t, {
    'package.json': JSON.stringify({ name: 'shop', type: 'module' }),
    'watt.config.ts': `
      import { defineConfig } from '${wattpmEntry}'
      import { node } from '@platformatic/node'

      export default defineConfig({
        logger: { level: 'warn' },
        application: { workers: 2, config: node({ main: './server.js' }) }
      })
    `,
    'server.js': ''
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  deepStrictEqual(config.logger, { level: 'warn' })
  strictEqual(config.applications[0].workers, 2)
  strictEqual(config.applications[0].module, '@platformatic/node')
})

test('the functional form receives the config context, and TypeScript is stripped natively', async t => {
  const root = await createProject(t, {
    'package.json': JSON.stringify({ name: 'shop', type: 'module' }),
    'watt.config.ts': `
      import { defineConfig } from '${wattpmEntry}'

      const level: string = 'debug'

      export default defineConfig(({ command, mode, production }) => ({
        watch: command === 'dev',
        logger: { level: production ? 'warn' : level },
        applications: [{ id: 'api', path: '.', config: { module: '@platformatic/node' } }],
        seenMode: mode
      }))
    `
  })

  const development = await loadConfiguration({ cwd: root, command: 'dev', realEnv: {} })

  strictEqual(development.config.watch, true)
  strictEqual(development.config.logger.level, 'debug')
  strictEqual(development.config.seenMode, 'development')

  const production = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  strictEqual(production.config.watch, false)
  strictEqual(production.config.logger.level, 'warn')
  strictEqual(production.config.seenMode, 'production')
})

test('the factory callback form is deferred and resolved by the loader', async t => {
  const root = await createProject(t, {
    'package.json': JSON.stringify({ name: 'shop', type: 'module' }),
    'watt.config.ts': `
      import { node } from '@platformatic/node'

      export default node(async ({ mode }) => ({ main: mode === 'production' ? './prod.js' : './dev.js' }))
    `
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  // next(cb) desugars to async ctx => next(await cb(ctx)), which classification rule 1 calls.
  deepStrictEqual(config.applications[0].config.node, { main: './prod.js' })
})

test('a monorepo evaluates each per-app file in its own worker under its own environment', async t => {
  const root = await createProject(t, {
    'package.json': JSON.stringify({ name: 'proj', type: 'module' }),
    '.env': 'SHARED=root\n',
    'watt.config.ts': `
      import { defineConfig } from '${wattpmEntry}'

      export default defineConfig({ autoload: { path: 'web' } })
    `,
    'web/api/package.json': JSON.stringify({ name: '@acme/api', type: 'module' }),
    'web/api/.env': 'PORT=3001\n',
    'web/api/watt.config.ts': `
      import { node } from '@platformatic/node'

      export default node({
        main: './index.js',
        server: { port: Number(process.env.PORT), hostname: process.env.SHARED }
      })
    `,
    'web/frontend/package.json': JSON.stringify({ name: 'frontend', type: 'module' }),
    'web/frontend/.env': 'PORT=3002\n',
    'web/frontend/watt.config.ts': `
      import { node } from '@platformatic/node'

      export default node({ main: './index.js', server: { port: Number(process.env.PORT) } })
    `
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  deepStrictEqual(
    config.applications.map(entry => [entry.id, entry.config.server.port]),
    [
      ['api', 3001],
      ['frontend', 3002]
    ]
  )

  // The scope is stripped from @acme/api, and the root chain still layers under each application.
  strictEqual(config.applications[0].config.server.hostname, 'root')
})

test('an option the capability schema does not have survives to be rejected by that schema', async t => {
  const root = await createProject(t, {
    'package.json': JSON.stringify({ name: 'shop', type: 'module' }),
    'watt.config.ts': `
      import { node } from '@platformatic/node'

      export default node({ notAnOption: true })
    `
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })

  // The factory does not police the option set: an unknown key lands at the top level, where the
  // capability's own AJV schema rejects it with a precise error. That scales automatically as
  // capabilities add options, where a factory-side allowlist would drift.
  strictEqual(config.applications[0].config.notAnOption, true)
})

test('a factory result is plain serializable data', async t => {
  const root = await createProject(t, {
    'package.json': JSON.stringify({ name: 'shop', type: 'module' }),
    'watt.config.ts': `
      import { node } from '@platformatic/node'

      export default node({ main: './server.js' })
    `
  })

  const { config } = await loadConfiguration({ cwd: root, command: 'start', realEnv: {} })
  const definition = config.applications[0].config

  deepStrictEqual(JSON.parse(JSON.stringify(definition)), definition)
  deepStrictEqual(Object.getOwnPropertySymbols(definition), [])
})
