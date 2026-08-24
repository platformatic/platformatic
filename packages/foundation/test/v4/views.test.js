import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  loadConfiguration,
  resolveConfigurationEnvironment,
  resolveEnvFileSources,
  resolveWorkerEnvironment
} from '../../lib/v4/index.js'
import { createTree } from './helper.js'

// The plan names this test: for an application configured by a per-app file, the config-time and
// runtime views must agree on their env-file rungs. They differ by design on the env blocks and
// the injected PLT_<ID>_URL values, and on nothing else.
test('the two views agree on their env-file rungs for an application with its own file', async t => {
  const root = await createTree(t, {
    'watt.config.js': '',
    '.env': 'ROOT_ONLY=root\nSHARED=root\n',
    'web/.env': 'MIDDLE=web\nSHARED=web\n',
    'web/api/.env': 'OWN=api\nSHARED=api\n'
  })

  const fileSources = await resolveEnvFileSources({
    directory: join(root, 'web/api'),
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root,
    mode: 'production'
  })

  const realEnv = { REAL: 'real', SHARED: 'real' }
  const evaluation = resolveConfigurationEnvironment({ realEnv, fileSources, production: true })

  const runtime = resolveWorkerEnvironment({
    realEnv,
    entryEnv: { FROM_ENTRY: 'entry' },
    rootEnv: { FROM_ROOT: 'root-block' },
    injectedUrls: { PLT_API_URL: 'http://api.plt.local' },
    fileSources,
    production: true
  })

  const rungsOnly = Object.fromEntries(
    Object.entries(runtime).filter(([key]) => !['FROM_ENTRY', 'FROM_ROOT', 'PLT_API_URL'].includes(key))
  )

  deepStrictEqual(rungsOnly, evaluation)

  // And the file rungs themselves are the layered set, nearest winning, with the real environment
  // above all of them.
  deepStrictEqual(evaluation, {
    REAL: 'real',
    SHARED: 'real',
    OWN: 'api',
    MIDDLE: 'web',
    ROOT_ONLY: 'root',
    NODE_ENV: 'production'
  })
})

test('a root-inline entry evaluates against the root file directory, and its workers do not', async t => {
  // The position asymmetry: the same factory expression evaluates against the root config's chain
  // when it lives root-inline and the application's chain when it lives in the per-app file.
  const root = await createTree(t, {
    'watt.config.js': '',
    '.env': 'WHO=root\n',
    'web/api/.env': 'WHO=api\n'
  })

  const inlineEvaluation = resolveConfigurationEnvironment({
    realEnv: {},
    fileSources: await resolveEnvFileSources({
      directory: root,
      envRoot: root,
      decidingDirectory: root,
      decidingEnvRoot: root,
      mode: 'production'
    })
  })

  const workerRuntime = resolveWorkerEnvironment({
    realEnv: {},
    fileSources: await resolveEnvFileSources({
      directory: join(root, 'web/api'),
      envRoot: root,
      decidingDirectory: root,
      decidingEnvRoot: root,
      mode: 'production'
    })
  })

  strictEqual(inlineEvaluation.WHO, 'root')
  strictEqual(workerRuntime.WHO, 'api')
})

test('envfile governs both views, at the same layer', async t => {
  const root = await createTree(t, {
    'watt.config.js': '',
    '.env': 'BASE=root\n',
    'web/api/.env': 'WHO=conventional\n',
    'web/api/deploy.env': 'WHO=named\n'
  })

  const fileSources = await resolveEnvFileSources({
    directory: join(root, 'web/api'),
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root,
    mode: 'production',
    envfile: './deploy.env'
  })

  const evaluation = resolveConfigurationEnvironment({ realEnv: {}, fileSources })
  const runtime = resolveWorkerEnvironment({ realEnv: {}, fileSources })

  deepStrictEqual(evaluation, runtime)
  strictEqual(evaluation.WHO, 'named')
  strictEqual(evaluation.BASE, 'root')
})

test('the loader resolves every application worker environment before any worker starts', async t => {
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    '.env': 'SHARED=root-file\nONLY_FILE=file\n',
    'watt.config.js': `
      export default {
        env: { FROM_ROOT_BLOCK: 'root', SHARED: 'root-block' },
        applications: [
          { id: 'api', path: './web/api', env: { FROM_ENTRY: 'entry', SHARED: 'entry' }, config: { module: '@acme/x' } },
          { id: 'web', path: './web/frontend', config: { module: '@acme/x' } }
        ]
      }
    `,
    'web/api/index.js': '',
    'web/frontend/index.js': ''
  })

  const { config } = await loadConfiguration({
    cwd: root,
    command: 'start',
    realEnv: { REAL: 'real' },
    validateCapabilities: false
  })

  const [api, web] = config.applications

  // The entry block beats the root block, and both beat the files — but the real environment beats
  // all of them, which is the deliberate inversion of v3, where blocks were pins.
  strictEqual(api.workerEnv.SHARED, 'entry')
  strictEqual(web.workerEnv.SHARED, 'root-block')
  strictEqual(api.workerEnv.FROM_ROOT_BLOCK, 'root')
  strictEqual(api.workerEnv.ONLY_FILE, 'file')
  strictEqual(api.workerEnv.REAL, 'real')

  // Injection covers every application, the application's own PLT_<SELF>_URL included.
  strictEqual(api.workerEnv.PLT_API_URL, 'http://api.plt.local')
  strictEqual(api.workerEnv.PLT_WEB_URL, 'http://web.plt.local')
  strictEqual(web.workerEnv.PLT_WEB_URL, 'http://web.plt.local')

  // And it stays out of the configuration DTO: an environment on every entry would put every
  // secret into anything that serializes the config.
  ok(!Object.keys(api).includes('workerEnv'))
  ok(!JSON.stringify(config).includes('http://api.plt.local'))
})

test('a runtime that already has a topology key keeps its own value', async t => {
  // The runtime's process.env is the oracle, so a container or k8s override wins over injection.
  const root = await createTree(t, {
    'package.json': '{ "name": "proj" }',
    'watt.config.js':
      'export default { applications: [{ id: "api", path: ".", config: { module: "@acme/x" } }] }'
  })

  const { config } = await loadConfiguration({
    cwd: root,
    command: 'start',
    realEnv: { PLT_API_URL: 'http://api.internal' },
    validateCapabilities: false
  })

  strictEqual(config.applications[0].workerEnv.PLT_API_URL, 'http://api.internal')
})
