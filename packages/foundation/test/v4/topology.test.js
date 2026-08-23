import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
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
    ...overrides
  })
}

test('autoload expands directories and derives ids the same way every other position does', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { autoload: { path: "web" } }',
    'web/api/package.json': '{ "name": "@acme/api" }',
    'web/frontend/package.json': '{ "name": "frontend" }',
    'web/worker/index.js': '',
    'web/notes.md': ''
  })

  const { config } = await evaluate(root)

  // v3 used the directory name alone here. Stripping the scope is not cosmetic: the id becomes a
  // DNS label in http://<id>.plt.local, where @acme would parse as userinfo.
  deepStrictEqual(config.applications, [
    { id: 'api', path: join(root, 'web/api') },
    { id: 'frontend', path: join(root, 'web/frontend') },
    { id: 'worker', path: join(root, 'web/worker') }
  ])
})

test('autoload honours exclude and mappings', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default {
        autoload: { path: 'web', exclude: ['fixtures'], mappings: { api: { id: 'backend', workers: 3 } } }
      }
    `,
    'web/api/index.js': '',
    'web/fixtures/index.js': ''
  })

  const { config } = await evaluate(root)

  deepStrictEqual(config.applications, [{ id: 'backend', path: join(root, 'web/api'), workers: 3 }])
})

test('an explicit entry wins over the autoloaded one and keeps its position', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default {
        applications: [{ id: 'api', workers: 5 }, { id: 'standalone', path: './elsewhere' }],
        autoload: { path: 'web' }
      }
    `,
    'web/api/index.js': '',
    'web/zeta/index.js': ''
  })

  const { config } = await evaluate(root)

  // Shallow explicit-wins merge, v3 semantics; assigning in place rather than reordering is what
  // keeps a recorded deferred slot pointing at the entry it was recorded for.
  deepStrictEqual(config.applications, [
    { id: 'api', workers: 5, path: join(root, 'web/api') },
    { id: 'standalone', path: './elsewhere' },
    { id: 'zeta', path: join(root, 'web/zeta') }
  ])
})

test('disabled entries are dropped, and the object form is keyed by mode', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default {
        applications: [
          { id: 'always', path: '.' },
          { id: 'never', path: '.', enabled: false },
          { id: 'stringly', path: '.', enabled: 'false' },
          { id: 'bymode', path: '.', enabled: { production: false, development: true } },
          { id: 'staged', path: '.', enabled: { staging: false } }
        ]
      }
    `
  })

  // production and development remain the default mode names under start/build and dev, so every
  // v3 configuration keeps its meaning.
  const { config: inProduction } = await evaluate(root, { production: true, mode: 'production' })
  deepStrictEqual(inProduction.applications.map(entry => entry.id), ['always', 'staged'])

  const { config: inDevelopment } = await evaluate(root, { production: false, command: 'dev', mode: 'development' })
  deepStrictEqual(inDevelopment.applications.map(entry => entry.id), ['always', 'bymode', 'staged'])

  // And enabled: { staging: false } now does what it looks like, where v3 silently ignored the key
  // because it only ever compared against the two default names.
  const { config: inStaging } = await evaluate(root, { production: true, mode: 'staging' })
  deepStrictEqual(inStaging.applications.map(entry => entry.id), ['always', 'bymode'])
})

test('resolve candidates are recorded after expansion and before the enabled filter', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default {
        applications: [
          { id: 'excluded', path: './external/excluded', url: 'https://github.com/acme/excluded.git', enabled: false },
          { id: 'local', path: '.' }
        ],
        autoload: { path: 'web' }
      }
    `,
    'web/autoloaded/index.js': ''
  })

  const { config, resolveCandidates } = await evaluate(root)

  // A remote entry excluded in the current mode is fetched all the same: resolve is owed the
  // entries it is expected to fetch, not the entries this boot would run.
  deepStrictEqual(resolveCandidates, [
    { id: 'excluded', url: 'https://github.com/acme/excluded.git', path: './external/excluded', gitBranch: undefined }
  ])

  deepStrictEqual(config.applications.map(entry => entry.id), ['local', 'autoloaded'])
})

test('the projection carries no capability configuration, so it cannot be booted by accident', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default {
        applications: [
          {
            id: 'remote',
            path: './external/remote',
            url: 'https://github.com/acme/remote.git',
            gitBranch: 'next',
            config: { module: '@platformatic/node' }
          }
        ]
      }
    `
  })

  const { resolveCandidates } = await evaluate(root)

  deepStrictEqual(resolveCandidates, [
    {
      id: 'remote',
      url: 'https://github.com/acme/remote.git',
      path: './external/remote',
      gitBranch: 'next'
    }
  ])
})

test('a deferred config slot is called with the same context and spliced into its position', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default {
        applications: [
          { id: 'first', path: '.' },
          { id: 'second', path: '.', config: async ctx => ({ module: '@platformatic/node', mode: ctx.mode }) }
        ]
      }
    `
  })

  const { config } = await evaluate(root, { mode: 'staging' })

  deepStrictEqual(config.applications[1].config, { module: '@platformatic/node', mode: 'staging' })
})

test('a disabled entry deferred config callback never runs', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      import { writeFileSync } from 'node:fs'
      import { join } from 'node:path'

      export default {
        applications: [
          {
            id: 'legacy',
            path: '.',
            enabled: false,
            config: () => {
              writeFileSync(join(import.meta.dirname, 'called.txt'), 'x')
              return { module: '@platformatic/legacy-capability' }
            }
          }
        ]
      }
    `
  })

  const { config } = await evaluate(root)

  // An entry excluded from this boot may name a capability the production image does not ship, or
  // call requiredEnv() for a variable decommissioned with it. Invoking it to find out would fail a
  // boot that excludes it.
  strictEqual(config.applications.length, 0)
  strictEqual(existsSync(join(root, 'called.txt')), false)
})

test('the enabled filter does not misdirect a surviving entry slot', async t => {
  const root = await createTree(t, {
    'watt.config.js': `
      export default {
        applications: [
          { id: 'dropped', path: '.', enabled: false, config: () => ({ module: '@platformatic/gone' }) },
          { id: 'kept', path: '.', config: () => ({ module: '@platformatic/node' }) }
        ]
      }
    `
  })

  const { config } = await evaluate(root)

  // Filtering shifts indices, so a slot addressed by position would be spliced into the wrong
  // entry. Recording the container rather than the index is what survives step 4.
  deepStrictEqual(config.applications, [
    { id: 'kept', path: '.', config: { module: '@platformatic/node' } }
  ])
})

test('a deferred config may not itself return a function', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [{ id: "a", path: ".", config: () => () => ({}) }] }'
  })

  await rejects(() => evaluate(root), { code: 'PLT_INVALID_CONFIG_VALUE' })
})

test('a function slot in a file that classifies as an application definition is an error', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { module: "@platformatic/gateway", application: { config: () => ({}) } }'
  })

  // A per-app file has no config slots, so the only thing that path can hold there is a capability
  // option that happens to be named config; calling it would be the loader inventing a callback.
  await rejects(() => evaluate(root), error => {
    strictEqual(error.code, 'PLT_DEFERRED_SLOT_IN_APPLICATION_DEFINITION')
    ok(error.message.includes('/application/config'))
    return true
  })
})

test('an inherited topology variable is reported once the ids are known', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [{ id: "api", path: "." }, { id: "web", path: "." }] }'
  })

  const { warnings } = await evaluate(root, { env: { PLT_API_URL: 'http://inherited' } })

  // The root worker cannot have these stripped — its ids are declared by the file being evaluated.
  // A warning rather than an error, because presence is not use.
  strictEqual(warnings.length, 1)
  strictEqual(warnings[0].key, 'PLT_API_URL')
  strictEqual(warnings[0].applicationId, 'api')
})

test('the orchestration shape is validated before expansion reads the filesystem', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { autoload: { path: 42 } }'
  })

  const schema = {
    type: 'object',
    properties: {
      autoload: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
    }
  }

  // Orchestration drives filesystem access — autoload.path decides which directories are read — so
  // it is checked before it is acted on, and coercion is off, so 42 is not quietly a string.
  await rejects(() => evaluate(root, { schema }), error => {
    strictEqual(error.code, 'PLT_INVALID_ROOT_CONFIGURATION')
    ok(error.message.includes('/autoload/path'))
    return true
  })
})

test('validation injects no defaults into the returned snapshot', async t => {
  const root = await createTree(t, {
    'watt.config.js': 'export default { applications: [{ id: "api", path: "." }] }'
  })

  const schema = {
    type: 'object',
    properties: { logger: { type: 'object', default: { level: 'info' } } }
  }

  const { config } = await evaluate(root, { schema })

  // The useDefaults pass runs main-side on the returned snapshot, which is what keeps the recorded
  // projection carrying authored values rather than schema-supplied ones.
  ok(!('logger' in config))
})
