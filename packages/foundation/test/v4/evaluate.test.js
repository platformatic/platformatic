import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { evaluateConfigurationFile } from '../../lib/v4/index.js'
import { createTree } from './helper.js'

async function evaluate (root, overrides = {}) {
  return evaluateConfigurationFile({
    path: join(root, 'watt.config.js'),
    directory: root,
    command: 'start',
    mode: 'production',
    production: true,
    timeout: 30000,
    ...overrides
  })
}

test('a plain object export is returned as a snapshot with the applications normalized', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [{ id: "api", path: "./web/api" }] }'
  })

  const { config } = await evaluate(root)

  deepStrictEqual(config.applications, [{ id: 'api', path: './web/api' }])
})

test('a function export is called once with the context and its resolved value classified', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default ctx => ({
        applications: [{ id: 'api', path: '.' }],
        logger: { level: ctx.production ? 'warn' : 'info' },
        mode: ctx.mode,
        command: ctx.command
      })
    `
  })

  const { config } = await evaluate(root, { command: 'build', mode: 'staging', production: true })

  strictEqual(config.logger.level, 'warn')
  strictEqual(config.mode, 'staging')
  strictEqual(config.command, 'build')
})

test('an async function export is awaited', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default async () => ({ applications: [], logger: { level: "info" } })'
  })

  const { config } = await evaluate(root)

  strictEqual(config.logger.level, 'info')
})

test('a function returning a function is an error naming the file', async t => {
  const root = await createTree(t, { 'watt.config.js': 'export default () => () => ({})' })

  await rejects(() => evaluate(root), error => {
    strictEqual(error.code, 'PLT_NESTED_FUNCTION_EXPORT')
    ok(error.message.includes('watt.config.js'))
    return true
  })
})

test('a bare application definition is auto-wrapped into the singular form', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { module: "@platformatic/node", server: { port: 3042 } }'
  })

  const { config } = await evaluate(root)

  deepStrictEqual(config.applications, [
    { config: { module: '@platformatic/node', server: { port: 3042 } }, path: root }
  ])
})

test('the singular shorthand normalizes to a one-element array and defaults its path', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { application: { workers: 2 } }'
  })

  const { config } = await evaluate(root)

  deepStrictEqual(config.applications, [{ workers: 2, path: root }])
  ok(!('application' in config))
})

test('the shorthand alongside applications or autoload is an error', async t => {
  const withApplications = await createTree(t, {
    'watt.config.js': 'export default { application: { workers: 2 }, applications: [{ id: "a", path: "." }] }'
  })

  await rejects(() => evaluate(withApplications), error => {
    strictEqual(error.code, 'PLT_APPLICATION_SHORTHAND_CONFLICT')
    ok(error.message.includes('applications'))
    return true
  })

  const withAutoload = await createTree(t, {
    'watt.config.js': 'export default { application: { workers: 2 }, autoload: { path: "web" } }'
  })

  await rejects(() => evaluate(withAutoload), { code: 'PLT_APPLICATION_SHORTHAND_CONFLICT' })
})

test('an unserializable value is reported by JSON path rather than as a DataCloneError', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [], logger: { transport: () => {} } }'
  })

  await rejects(() => evaluate(root), error => {
    strictEqual(error.code, 'PLT_INVALID_CONFIG_VALUE')
    ok(error.message.includes('/logger/transport'))
    return true
  })
})

test('the worker never inherits the main process environment', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [], seen: process.env.PLT_TEST_LEAK ?? "absent" }'
  })

  process.env.PLT_TEST_LEAK = 'leaked'
  t.after(() => {
    delete process.env.PLT_TEST_LEAK
  })

  const { config } = await evaluate(root, { env: { NODE_ENV: 'production' } })

  strictEqual(config.seen, 'absent')
})

test('the explicit env is what the configuration reads', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default ctx => ({ applications: [], fromEnv: process.env.API_URL, fromCtx: ctx.env.API_URL })'
  })

  const { config } = await evaluate(root, { env: { API_URL: 'http://api.example' } })

  strictEqual(config.fromEnv, 'http://api.example')
  strictEqual(config.fromCtx, 'http://api.example')
})

test('mutating process.env during evaluation is reported by key and does not propagate', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      process.env.CACHE_PREFIX = 'set-during-evaluation'
      delete process.env.REMOVED
      export default { applications: [] }
    `
  })

  const { mutatedEnvKeys } = await evaluate(root, { env: { REMOVED: 'x' } })

  deepStrictEqual(mutatedEnvKeys, ['CACHE_PREFIX', 'REMOVED'])
})

test('the import graph is streamed, and it survives a failed evaluation', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'import { level } from "./helper.js"\nexport default { applications: [], logger: { level } }',
    'helper.js': 'export const level = "debug"'
  })

  const streamed = []
  const { importedFiles, config } = await evaluate(root, { onImport: path => streamed.push(path) })

  strictEqual(config.logger.level, 'debug')
  ok(importedFiles.includes(join(root, 'helper.js')))
  ok(streamed.includes(join(root, 'helper.js')))

  const broken = await createTree(t, {
    'watt.config.js': 'import "./helper.js"\nexport default { applications: [] }',
    'helper.js': 'throw new Error("helper is broken")'
  })

  // A watcher holding only the last good set is not watching the helper that just threw, so
  // fixing it would trigger no reload and wattpm dev would look hung on the file being edited.
  await rejects(() => evaluate(broken), error => {
    ok(error.importedFiles.includes(join(broken, 'helper.js')))
    return true
  })
})

test('ctx.addWatchFile reports a path a configuration reads without importing', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default ctx => {
        ctx.addWatchFile('./ports.json')
        return { applications: [] }
      }
    `,
    'ports.json': '{}'
  })

  const declared = []
  const { watchedFiles } = await evaluate(root, { onWatchFile: path => declared.push(path) })

  deepStrictEqual(watchedFiles, [join(root, 'ports.json')])
  deepStrictEqual(declared, [join(root, 'ports.json')])
})

test('evaluation runs under a deadline rather than hanging boot forever', async t => {
  // A pending handle is what makes this a hang rather than a deadlock — an awaited fetch to a dead
  // host is the real shape of it.
  const root = await createTree(t, {
    'watt.config.js':
      'export default async () => { await new Promise(resolve => setTimeout(resolve, 60000)); return { applications: [] } }'
  })

  await rejects(() => evaluate(root, { timeout: 500 }), error => {
    strictEqual(error.code, 'PLT_CONFIGURATION_EVALUATION_TIMEOUT')
    ok(error.message.includes('500'))
    return true
  })
})

test('a configuration that deadlocks is reported at once rather than at the deadline', async t => {
  // Awaiting a promise nothing will ever settle leaves an empty event loop, so Node exits the
  // thread immediately. The timer never fires, and reporting it as a timeout would be a lie about
  // both the cause and the elapsed time.
  const root = await createTree(t, {
    'watt.config.js': 'export default async () => { await new Promise(() => {}) }'
  })

  await rejects(() => evaluate(root, { timeout: 30000 }), error => {
    strictEqual(error.code, 'PLT_EVALUATION_ENDED_WITHOUT_RESULT')
    return true
  })
})

test('a configuration that calls process.exit is reported, not silently empty', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'process.exit(3)\nexport default { applications: [] }'
  })

  await rejects(() => evaluate(root), error => {
    strictEqual(error.code, 'PLT_EVALUATION_ENDED_WITHOUT_RESULT')
    ok(error.message.includes('3'))
    return true
  })
})

test('a per-app file whose export classifies as a root config is an error naming both', async t => {
  const root = await createTree(t, { 'watt.config.js': 'export default { applications: [] }' })

  await rejects(
    () => evaluate(root, { role: 'application', applicationId: 'frontend' }),
    error => {
      strictEqual(error.code, 'PLT_ROOT_CONFIGURATION_IN_APPLICATION_ENTRY')
      ok(error.message.includes('frontend'))
      return true
    }
  )
})

test('a per-app file returns the application definition', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default ({ mode }) => ({ module: "@platformatic/next", cache: mode === "test" ? undefined : { adapter: "redis" } })'
  })

  const { config } = await evaluate(root, { role: 'application', applicationId: 'frontend', mode: 'production' })

  deepStrictEqual(config, { module: '@platformatic/next', cache: { adapter: 'redis' } })
})

test('type stripping loads a .ts configuration', async t => {
  const root = await createTree(t, {
    'watt.config.ts': 'const level: string = "info"\nexport default { applications: [], logger: { level } }'
  })

  const { config } = await evaluate(root, { path: join(root, 'watt.config.ts') })

  strictEqual(config.logger.level, 'info')
})
