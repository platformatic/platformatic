import { loadConfiguration } from '@platformatic/foundation/lib/v4/index.js'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { createTemporaryDirectory, wattpmUtils } from './helper.js'

const packagesDir = resolve(import.meta.dirname, '../..')

async function project (t, files, { type = 'commonjs', name = 'legacy' } = {}) {
  const root = await createTemporaryDirectory(t, 'migrate')

  await writeFile(join(root, 'package.json'), JSON.stringify({ name, type }), 'utf-8')

  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(root, name), typeof contents === 'string' ? contents : JSON.stringify(contents), 'utf-8')
  }

  return root
}

// The emitted file imports its capability, so it only loads where that capability resolves — which
// is the state a real migrated project is in.
async function linkCapability (root, name) {
  await mkdir(join(root, 'node_modules/@platformatic'), { recursive: true })
  await symlink(join(packagesDir, name), join(root, 'node_modules/@platformatic', name), 'dir')
}

async function linkPackage (root, directory, name) {
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(join(packagesDir, directory), join(root, 'node_modules', name), 'dir')
}

test('migrate - converts a single-application configuration into a file the loader accepts', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/@platformatic/next/3.65.0.json',
      cache: { adapter: 'redis', url: 'redis://localhost:6379' },
      server: { hostname: '127.0.0.1', port: 3042 }
    }
  })

  await linkCapability(root, 'next')

  const migrateProcess = await wattpmUtils('migrate', root)
  ok(migrateProcess.stdout.includes('Migrated platformatic.json to watt.config.mjs'))

  // The legacy file goes: v4 refuses a directory that still has one, so leaving it would mean
  // reporting success and handing back a project that cannot boot.
  strictEqual(await fileExists(join(root, 'platformatic.json')), false)

  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')

  // It imports what it uses, which is what lets it carry no $schema stamp: the file identifies
  // itself, so there is nothing to go stale when the schema version moves.
  ok(emitted.includes("import { next } from '@platformatic/next'"), emitted)
  ok(!emitted.includes('$schema'), emitted)
  ok(emitted.includes("adapter: 'redis'"), emitted)

  /*
    The round trip is the point: a migration that emits something the loader refuses has converted
    nothing. This is the check the plan calls step 3, run against migrate's own output.
  */
  const loaded = await loadConfiguration({
    cwd: root,
    configPath: join(root, 'watt.config.mjs'),
    command: 'start',
    production: true,
    realEnv: {},
    validateCapabilities: false
  })

  strictEqual(loaded.config.applications.length, 1)
  strictEqual(loaded.config.applications[0].module, '@platformatic/next')
  deepStrictEqual(loaded.config.applications[0].config.cache, { adapter: 'redis', url: 'redis://localhost:6379' })
})

test('migrate - writes .js where the package is a module and .mjs where it is not', async t => {
  const esm = await project(
    t,
    { 'platformatic.json': { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' } },
    { type: 'module' }
  )

  await wattpmUtils('migrate', esm)
  ok(await readFile(join(esm, 'watt.config.js'), 'utf-8'))

  // `.js` in a "type": "commonjs" package is CommonJS, where `export default` is a syntax error.
  const cjs = await project(t, {
    'platformatic.json': { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }
  })

  await wattpmUtils('migrate', cjs)
  ok(await readFile(join(cjs, 'watt.config.mjs'), 'utf-8'))
})

test('migrate - writes the new name for a renamed module', async t => {
  const root = await project(t, {
    'platformatic.json': { $schema: 'https://schemas.platformatic.dev/@platformatic/composer/3.65.0.json' }
  })

  const migrateProcess = await wattpmUtils('migrate', root)
  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')

  ok(emitted.includes("import { gateway } from '@platformatic/gateway'"), emitted)
  ok(migrateProcess.stdout.includes('is now'), migrateProcess.stdout)
})

test('migrate - reads a configuration whose name it would not have looked for', async t => {
  const root = await project(t, {
    'config.production.yaml': '$schema: https://schemas.platformatic.dev/@platformatic/node/3.65.0.json\n'
  })

  // v3's -c accepted any filename, so a project whose scripts say `-c config.production.yaml` has a
  // real configuration that a candidates-only migrator would report as nothing to migrate.
  const migrateProcess = await wattpmUtils('migrate', root, '-c', 'config.production.yaml')

  ok(migrateProcess.stdout.includes('Migrated config.production.yaml'), migrateProcess.stdout)
})

for (const [name, files, expected] of [
  [
    'a root envfile',
    { 'platformatic.json': { $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json', envfile: '.env.prod' } },
    'envfile'
  ],
  [
    'interpolated values',
    {
      'platformatic.json': {
        $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json',
        server: { port: '{PORT}' }
      }
    },
    'interpolation'
  ],
  [
    // A structural position has to be concrete before anything is emitted: migrate needs the real
    // directory to know which applications exist at all.
    'an autoload path that resolves to nothing',
    {
      'platformatic.json': {
        $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
        autoload: { path: './web' }
      }
    },
    'does not exist'
  ],
  [
    'an unknown capability',
    { 'platformatic.json': { $schema: 'https://schemas.platformatic.dev/@platformatic/php/3.65.0.json' } },
    'not a capability this migrator knows'
  ]
]) {
  test(`migrate - refuses ${name}, and writes nothing`, async t => {
    const root = await project(t, files)

    const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

    strictEqual(migrateProcess.exitCode, 1)
    ok(migrateProcess.stdout.includes(expected), migrateProcess.stdout)

    /*
      Refusals are detected before anything is written, so a refused run leaves the project exactly
      as it found it. A migrator that had already emitted half a tree would be worse than one that
      declined, because nothing would say which half.
    */
    strictEqual(await fileExists(join(root, 'watt.config.mjs')), false)
    strictEqual(await fileExists(join(root, 'watt.config.js')), false)
  })
}

async function fileExists (path) {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

test('migrate - refuses to overwrite a configuration that is already there', async t => {
  const root = await project(t, {
    'platformatic.json': { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' },
    'watt.config.mjs': 'export default {}\n'
  })

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)
  ok(migrateProcess.stdout.includes('already exists'), migrateProcess.stdout)
  strictEqual(await readFile(join(root, 'watt.config.mjs'), 'utf-8'), 'export default {}\n')
})

test('migrate - says so when there is nothing it recognizes', async t => {
  const root = await project(t, {})

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)
  ok(migrateProcess.stdout.includes('No v3 configuration found'), migrateProcess.stdout)
  ok(migrateProcess.stdout.includes('--config'), migrateProcess.stdout)
})

test('migrate - puts the original back when the emitted configuration does not load', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json',
      // Refused by the v4 runtime schema, so the emitted file will not load — which is the case
      // this exists for: migrate cannot verify that a converted value means what it meant, but it
      // can refuse to leave behind something that does not load at all.
      strictEnv: true
    }
  })

  await linkCapability(root, 'node')

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)
  ok(migrateProcess.stdout.includes('does not load'), migrateProcess.stdout)

  /*
    The swap has to be undone in full: the emitted file gone and the original back byte for byte.
    A half-undone rollback is worse than no rollback, because the project looks migrated.
  */
  strictEqual(await fileExists(join(root, 'watt.config.mjs')), false)

  const restored = JSON.parse(await readFile(join(root, 'platformatic.json'), 'utf-8'))
  strictEqual(restored.strictEnv, true)
})

test('migrate - unwraps a runtime block into defineConfig with the singular shorthand', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/@platformatic/next/3.65.0.json',
      cache: { adapter: 'redis', url: 'redis://localhost:6379' },
      runtime: {
        server: { hostname: '127.0.0.1', port: 3042 },
        logger: { level: 'info' },
        managementApi: true,
        application: { workers: 2 }
      }
    }
  })

  await linkCapability(root, 'next')
  await linkPackage(root, 'wattpm', 'wattpm')

  await wattpmUtils('migrate', root)

  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')

  // The factory call sits inside the object as a call, not as the text of one.
  ok(emitted.includes('config: next({'), emitted)

  const loaded = await loadConfiguration({
    cwd: root,
    configPath: join(root, 'watt.config.mjs'),
    command: 'start',
    production: true,
    realEnv: {},
    validateCapabilities: true,
    onWarning () {},
    onInfo () {}
  })

  const [application] = loaded.config.applications

  // The runtime block unwraps to the root...
  strictEqual(loaded.config.logger.level, 'info')
  strictEqual(loaded.config.managementApi, true)

  // ...except for `application`, which becomes the shorthand...
  strictEqual(application.workers, 2)

  // ...and `server`, which moves into the capability configuration, because v4 has no root server:
  // an application declares its own address.
  strictEqual(application.config.server.port, 3042)
  strictEqual(application.config.cache.adapter, 'redis')
})

test('migrate - pins the id v3 used, and says so when the label grammar changes it', async t => {
  const root = await project(
    t,
    {
      'platformatic.json': {
        $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json',
        runtime: { logger: { level: 'info' } }
      }
    },
    { name: '@acme/my_app' }
  )

  const migrateProcess = await wattpmUtils('migrate', root)
  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')

  /*
    v3 stripped the scope and v4 does too, so the disagreement is only the underscore — which is a
    legal package name and not a legal id. Rewriting it silently would move the mesh hostname, the
    injected variable, the metrics label and every sibling's dependencies entry at once.
  */
  ok(emitted.includes("id: 'my-app'"), emitted)
  ok(migrateProcess.stdout.includes('my_app'), migrateProcess.stdout)
  ok(migrateProcess.stdout.includes('mesh hostname'), migrateProcess.stdout)
})

test('migrate - emits a file per application plus a thin root', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      logger: { level: 'warn' },
      services: [
        { id: 'api', path: './services/api', config: 'platformatic.json', workers: 2 },
        { id: 'inferred', path: './services/inferred' }
      ]
    }
  })

  await mkdir(join(root, 'services/api'), { recursive: true })
  await writeFile(
    join(root, 'services/api/platformatic.json'),
    JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
    'utf-8'
  )
  // A real zero-config application has sources for the detector to read; an empty directory is
  // something v4 refuses, and rightly.
  await mkdir(join(root, 'services/inferred'), { recursive: true })
  await writeFile(join(root, 'services/inferred/index.js'), 'export default {}\n', 'utf-8')
  await writeFile(
    join(root, 'services/inferred/package.json'),
    JSON.stringify({ name: 'inferred', type: 'module', main: 'index.js' }),
    'utf-8'
  )

  await linkCapability(root, 'node')
  await linkPackage(root, 'wattpm', 'wattpm')

  const migrateProcess = await wattpmUtils('migrate', root)

  // The application's own file, in its own directory.
  const application = await readFile(join(root, 'services/api/watt.config.mjs'), 'utf-8')
  ok(application.includes("import { node } from '@platformatic/node'"), application)
  strictEqual(await fileExists(join(root, 'services/api/platformatic.json')), false)

  const emittedRoot = await readFile(join(root, 'watt.config.mjs'), 'utf-8')

  /*
    `services` is spelled `applications`, and the entry's `config` is gone: it named the path to the
    application's own configuration in v3, and in v4 that file simply is the configuration, so the
    key has nothing left to name.
  */
  ok(emittedRoot.includes('applications:'), emittedRoot)
  ok(!emittedRoot.includes('services:'), emittedRoot)
  ok(!emittedRoot.includes("config: 'platformatic.json'"), emittedRoot)

  // A directory with no configuration of its own is left alone: that is v4's zero-config case
  // rather than an error, and saying so beats silently doing nothing.
  ok(migrateProcess.stdout.includes('inferred'), migrateProcess.stdout)

  const loaded = await loadConfiguration({
    cwd: root,
    configPath: join(root, 'watt.config.mjs'),
    command: 'start',
    production: true,
    realEnv: {},
    validateCapabilities: false,
    onWarning () {},
    onInfo () {}
  })

  strictEqual(loaded.config.logger.level, 'warn')
  strictEqual(loaded.config.applications.length, 2)
  strictEqual(loaded.config.applications.find(entry => entry.id === 'api').workers, 2)
})

test('migrate - refuses a later application before writing an earlier one', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      applications: [
        { id: 'first', path: './services/first' },
        { id: 'second', path: './services/second' }
      ]
    }
  })

  for (const [name, contents] of [
    ['first', { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }],
    // The second one interpolates, which this migrator refuses — and it is reached only after the
    // first has already been converted on disk.
    ['second', { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json', server: { port: '{PORT}' } }]
  ]) {
    await mkdir(join(root, 'services', name), { recursive: true })
    await writeFile(join(root, 'services', name, 'platformatic.json'), JSON.stringify(contents), 'utf-8')
  }

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)
  ok(migrateProcess.stdout.includes('interpolation'), migrateProcess.stdout)

  /*
    The first application is untouched because nothing was written at all: every refusal is computed
    from the tree as it stands, before the first file is emitted. The weaker property -- writing and
    then undoing -- is what the validation path below has to rely on, and this one does not.
  */
  strictEqual(await fileExists(join(root, 'services/first/watt.config.mjs')), false)
  strictEqual(await fileExists(join(root, 'services/first/platformatic.json')), true)
  strictEqual(await fileExists(join(root, 'services/second/platformatic.json')), true)
  strictEqual(await fileExists(join(root, 'watt.config.mjs')), false)
  strictEqual(await fileExists(join(root, 'platformatic.json')), true)
})

test('migrate - undoes every file it touched when the emitted tree does not load', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      // Legal v3 and refused by the v4 runtime schema, so it survives the pre-flight and fails
      // validation -- by which point both applications have been converted and their legacy files
      // deleted, which is the state this exists to prove does not survive.
      strictEnv: true,
      applications: [
        { id: 'first', path: './services/first' },
        { id: 'second', path: './services/second' }
      ]
    }
  })

  for (const [name, contents] of [
    ['first', { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }],
    ['second', { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }]
  ]) {
    await mkdir(join(root, 'services', name), { recursive: true })
    await writeFile(join(root, 'services', name, 'platformatic.json'), JSON.stringify(contents), 'utf-8')
  }

  await linkCapability(root, 'node')
  // The root file imports wattpm, and an unresolvable import is reported rather than treated as bad
  // output -- so without this the run would end in a warning and validate nothing.
  await linkPackage(root, 'wattpm', 'wattpm')

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)
  ok(migrateProcess.stdout.includes('does not load'), migrateProcess.stdout)

  /*
    Every directory the run touched goes back, not only the one that failed. A tree that is neither
    v3 nor v4, with nothing in it saying which half moved, is the worst outcome available here.
  */
  for (const name of ['first', 'second']) {
    strictEqual(await fileExists(join(root, 'services', name, 'watt.config.mjs')), false)
    strictEqual(await fileExists(join(root, 'services', name, 'platformatic.json')), true)
  }

  strictEqual(await fileExists(join(root, 'watt.config.mjs')), false)
  strictEqual(await fileExists(join(root, 'platformatic.json')), true)
})

test('migrate - refuses two applications that would write one file, and ids that collide once renamed', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      // Legal v3: each entry named its own config file, so one directory held two applications.
      applications: [
        { id: 'my_api', path: './services/shared', config: 'a.json' },
        { id: 'my-api', path: './services/shared', config: 'b.json' }
      ]
    }
  })

  await mkdir(join(root, 'services/shared'), { recursive: true })

  for (const name of ['a.json', 'b.json']) {
    await writeFile(
      join(root, 'services/shared', name),
      JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
      'utf-8'
    )
  }

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)

  // Both refusals, in one report: the shared target, and the id `my_api` becoming the `my-api` that
  // is already taken. Neither is a state v3 ever called invalid, and both are computable by looking.
  ok(migrateProcess.stdout.includes('would both be written to'), migrateProcess.stdout)
  ok(migrateProcess.stdout.includes('resolve to the id'), migrateProcess.stdout)
  strictEqual(await fileExists(join(root, 'services/shared/watt.config.mjs')), false)
})

test('migrate - refuses an application outside the project, and a missing envfile', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      applications: [
        { id: 'outside', path: '../elsewhere' },
        { id: 'inside', path: './services/inside', envfile: './services/inside/deploy.env' }
      ]
    }
  })

  await mkdir(join(root, 'services/inside'), { recursive: true })
  await writeFile(
    join(root, 'services/inside/platformatic.json'),
    JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
    'utf-8'
  )

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)
  ok(migrateProcess.stdout.includes('outside this project'), migrateProcess.stdout)
  ok(migrateProcess.stdout.includes('does not exist'), migrateProcess.stdout)
  strictEqual(await fileExists(join(root, 'services/inside/watt.config.mjs')), false)
})

test('migrate - rebases an envfile the entry declared against the root', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      applications: [{ id: 'api', path: './services/api', envfile: './services/api/deploy.env' }]
    }
  })

  await mkdir(join(root, 'services/api'), { recursive: true })
  await writeFile(join(root, 'services/api/deploy.env'), 'TOKEN=secret\n', 'utf-8')
  await writeFile(
    join(root, 'services/api/platformatic.json'),
    JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
    'utf-8'
  )

  await linkCapability(root, 'node')
  await linkPackage(root, 'wattpm', 'wattpm')

  await wattpmUtils('migrate', root)

  /*
    v3 resolved an entry's envfile against the runtime root and v4 resolves it against the
    application's directory, so carrying the string across unchanged would silently point it at a
    file that is not there -- which v4 makes a load error.
  */
  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')
  ok(emitted.includes("envfile: 'deploy.env'"), emitted)
})

test('migrate - emits an application in the root directory inline', async t => {
  const root = await project(t, {
    // Legal v3: the entry's own config file names the application, so the runtime and one of its
    // applications shared a directory.
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      applications: [
        { id: 'main', path: '.', config: 'platformatic.service.json' },
        { id: 'api', path: './services/api' }
      ]
    },
    'platformatic.service.json': {
      $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json',
      server: { port: 3042 }
    }
  })

  await mkdir(join(root, 'services/api'), { recursive: true })
  await writeFile(
    join(root, 'services/api/platformatic.json'),
    JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
    'utf-8'
  )

  await linkCapability(root, 'node')
  await linkPackage(root, 'wattpm', 'wattpm')

  await wattpmUtils('migrate', root)

  /*
    The per-app style would put a second v4 candidate in the root directory, which the loader
    refuses -- so this application's capability configuration becomes the entry's own `config`, and
    the file it came from goes.
  */
  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')

  ok(emitted.includes("import { node } from '@platformatic/node'"), emitted)
  ok(emitted.includes('config: node({'), emitted)
  strictEqual(await fileExists(join(root, 'platformatic.service.json')), false)

  // The sibling keeps the ordinary per-app emission: only the root directory has the collision.
  ok(await fileExists(join(root, 'services/api/watt.config.mjs')))

  const loaded = await loadConfiguration({
    cwd: root,
    configPath: join(root, 'watt.config.mjs'),
    command: 'start',
    production: true,
    realEnv: { ...process.env },
    validateCapabilities: false
  })

  deepStrictEqual(loaded.config.applications.map(entry => entry.id).sort(), ['api', 'main'])
})

test('migrate - converts autoloaded applications and pins only the ids that would move', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      autoload: { path: './web', exclude: ['shared'] }
    }
  })

  const applications = {
    // Named after its directory once the scope is stripped, so both versions answer `frontend`.
    frontend: '@acme/frontend',
    // The package name differs from the directory, so v4 would rename it.
    gateway: 'gateway-application',
    // Neither version's raw value is a legal label, so both resolve to `legacy-api` -- the case a
    // raw comparison passes over in silence.
    legacy_api: 'legacy_api',
    // No package.json at all: the directory name is the answer under both versions.
    plain: null
  }

  for (const [directory, name] of Object.entries(applications)) {
    await mkdir(join(root, 'web', directory), { recursive: true })

    if (name) {
      await writeFile(join(root, 'web', directory, 'package.json'), JSON.stringify({ name }), 'utf-8')
    }

    await writeFile(
      join(root, 'web', directory, 'platformatic.json'),
      JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
      'utf-8'
    )
  }

  // Excluded, so it is neither converted nor pinned.
  await mkdir(join(root, 'web/shared'), { recursive: true })
  await writeFile(
    join(root, 'web/shared/platformatic.json'),
    JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
    'utf-8'
  )

  await linkCapability(root, 'node')
  await linkPackage(root, 'wattpm', 'wattpm')

  await wattpmUtils('migrate', root)

  // Each autoloaded directory keeps being discovered; what it gains is its configuration in v4
  // spelling, in place of the one it had.
  for (const directory of Object.keys(applications)) {
    ok(await fileExists(join(root, 'web', directory, 'watt.config.mjs')), directory)
    strictEqual(await fileExists(join(root, 'web', directory, 'platformatic.json')), false, directory)
  }

  strictEqual(await fileExists(join(root, 'web/shared/watt.config.mjs')), false)
  strictEqual(await fileExists(join(root, 'web/shared/platformatic.json')), true)

  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')

  /*
    Pinned wherever the legal v4 id differs from the id v3 used, and nowhere else -- a root that
    pinned every directory would be noise, and one that pinned none would move two hostnames.
  */
  ok(emitted.includes("gateway: {\n        id: 'gateway'"), emitted)
  ok(emitted.includes("legacy_api: {\n        id: 'legacy-api'"), emitted)
  ok(!emitted.includes('frontend:'), emitted)
  ok(!emitted.includes('plain:'), emitted)
  ok(!emitted.includes('shared:'), emitted)

  const loaded = await loadConfiguration({
    cwd: root,
    configPath: join(root, 'watt.config.mjs'),
    command: 'start',
    production: true,
    realEnv: { ...process.env },
    validateCapabilities: false
  })

  deepStrictEqual(loaded.config.applications.map(entry => entry.id).sort(), [
    'frontend',
    'gateway',
    'legacy-api',
    'plain'
  ])
})

test('migrate - moves the root server block to the entrypoint and strips ports that never listened', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      entrypoint: 'api',
      // v4 has no root server. Which port was public still has to be said somewhere, and in v4 the
      // only place that can say it is the entrypoint's own capability configuration.
      server: { hostname: '0.0.0.0', port: 3000 },
      applications: [
        { id: 'api', path: './services/api' },
        { id: 'worker', path: './services/worker' }
      ]
    }
  })

  for (const [name, contents] of [
    ['api', { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }],
    // Neither the entrypoint nor useHttp, so this port never listened on v3 -- and in v4 a declared
    // port is a real listener.
    ['worker', { $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json', server: { port: 3000 } }]
  ]) {
    await mkdir(join(root, 'services', name), { recursive: true })
    await writeFile(join(root, 'services', name, 'platformatic.json'), JSON.stringify(contents), 'utf-8')
  }

  await linkCapability(root, 'node')
  await linkPackage(root, 'wattpm', 'wattpm')

  const migrateProcess = await wattpmUtils('migrate', root)

  const api = await readFile(join(root, 'services/api/watt.config.mjs'), 'utf-8')
  ok(api.includes('port: 3000'), api)
  ok(api.includes("hostname: '0.0.0.0'"), api)

  const worker = await readFile(join(root, 'services/worker/watt.config.mjs'), 'utf-8')
  ok(!worker.includes('server'), worker)
  ok(migrateProcess.stdout.includes('never listened on v3'), migrateProcess.stdout)

  // The root keeps neither, and would not validate if it did.
  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')
  ok(!emitted.includes('entrypoint'), emitted)
  ok(!emitted.includes('hostname'), emitted)
})

test('migrate - writes out the block useHttp stood for', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      applications: [
        { id: 'api', path: './services/api', useHttp: true },
        { id: 'other', path: './services/other' }
      ]
    }
  })

  for (const name of ['api', 'other']) {
    await mkdir(join(root, 'services', name), { recursive: true })
    await writeFile(
      join(root, 'services', name, 'platformatic.json'),
      JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
      'utf-8'
    )
  }

  await linkCapability(root, 'node')
  await linkPackage(root, 'wattpm', 'wattpm')

  await wattpmUtils('migrate', root)

  /*
    v4 has no useHttp, and the v4 entry schema does not admit it either -- so the defaults v3
    synthesized are written out. keepAliveTimeout is not among them: node is the basic family, whose
    server block does not admit it, and on v3 the key was inert there.
  */
  const api = await readFile(join(root, 'services/api/watt.config.mjs'), 'utf-8')
  ok(api.includes('port: 0'), api)
  ok(api.includes("hostname: '127.0.0.1'"), api)
  ok(!api.includes('keepAliveTimeout'), api)

  const emitted = await readFile(join(root, 'watt.config.mjs'), 'utf-8')
  ok(!emitted.includes('useHttp'), emitted)
})

test('migrate - refuses an entrypoint that depends on the environment', async t => {
  const root = await project(t, {
    'platformatic.json': {
      $schema: 'https://schemas.platformatic.dev/wattpm/3.65.0.json',
      server: { port: 3000 },
      applications: [
        { id: 'api', path: './services/api' },
        // Changes the survivor set, and with it which application is the only one left.
        { id: 'admin', path: './services/admin', enabled: { production: false, development: true } }
      ]
    }
  })

  for (const name of ['api', 'admin']) {
    await mkdir(join(root, 'services', name), { recursive: true })
    await writeFile(
      join(root, 'services', name, 'platformatic.json'),
      JSON.stringify({ $schema: 'https://schemas.platformatic.dev/@platformatic/node/3.65.0.json' }),
      'utf-8'
    )
  }

  const migrateProcess = await wattpmUtils('migrate', root, { reject: false })

  strictEqual(migrateProcess.exitCode, 1)
  ok(migrateProcess.stdout.includes('in production and'), migrateProcess.stdout)

  /*
    Which application owns the public address is structural in v4, so there is no faithful output
    here -- and picking one would move a project's public address without saying so.
  */
  strictEqual(await fileExists(join(root, 'watt.config.mjs')), false)
})
