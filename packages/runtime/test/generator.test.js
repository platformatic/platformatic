import { createDirectory, getPlatformaticVersion, safeRemove } from '@platformatic/foundation'
import assert from 'node:assert'
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import test from 'node:test'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { Generator as GatewayGenerator } from '../../gateway/lib/generator.js'
import { Generator as ApplicationGenerator } from '../../service/lib/generator.js'
import { loadConfiguration as loadRuntimeConfiguration } from '../index.js'
import { RuntimeGenerator, WrappedGenerator } from '../lib/generator.js'

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

let tmpCount = 0
async function createTemporaryDirectory (t, prefix) {
  const directory = join(tmpdir(), `test-runtime-${prefix}-${process.pid}-${tmpCount++}`)

  t.after(async () => {
    await safeRemove(directory)
  })

  await mkdir(directory)
  return directory
}

test('RuntimeGenerator - should create a runtime with 2 applications', async () => {
  const version = await getPlatformaticVersion()

  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  firstApplication.addEnvVar('FOO', 'bar', { overwrite: false, default: true })
  firstApplication.addEnvVar('FOO', 'foo', { overwrite: true, default: false })
  rg.addApplication(firstApplication, 'first-service')

  // adding another application
  const secondApplication = new ApplicationGenerator()
  rg.addApplication(secondApplication, 'second-service')

  rg.setConfig({
    port: 3043,
    logLevel: 'debug'
  })

  const output = await rg.prepare()

  assert.deepEqual(output, {
    targetDirectory: '/tmp/runtime',
    env: {
      PLT_FIRST_SERVICE_FOO: 'foo',
      PLT_FIRST_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
      PLT_FIRST_SERVICE_SERVER_LOGGER_LEVEL: 'info',
      PLT_FIRST_SERVICE_PORT: 3042,
      PLT_SECOND_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
      PLT_SECOND_SERVICE_SERVER_LOGGER_LEVEL: 'info',
      PLT_SECOND_SERVICE_PORT: 3043,
      PLT_SERVER_LOGGER_LEVEL: 'debug',
      PLT_MANAGEMENT_API: true
    }
  })

  // should list only runtime files
  const runtimeFileList = rg.listFiles()
  assert.deepEqual(runtimeFileList, ['package.json', 'watt.config.mjs', '.env', '.env.sample', '.gitignore'])

  // applications have correct target directory
  assert.equal(
    firstApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', firstApplication.config.applicationName)
  )
  assert.equal(
    secondApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', secondApplication.config.applicationName)
  )

  // Should have correct env variables
  const env = rg.getFileObject('.env')
  const envSample = rg.getFileObject('.env.sample')

  assert.notDeepStrictEqual(env.contents.split(/\r?\n/), envSample.contents.split(/\r?\n/))

  // The configuration the generator built. The file spells its values as expressions, and this is
  // about which settings it carries.
  assert.deepStrictEqual(rg.generatedConfig, {
    $schema: `https://schemas.platformatic.dev/wattpm/${version}.json`,
    watch: true,
    autoload: { path: 'applications', exclude: ['docs'] },
    logger: { level: '{PLT_SERVER_LOGGER_LEVEL}' },
    managementApi: '{PLT_MANAGEMENT_API}'
  })
})

test('RuntimeGenerator - should have a valid package.json', async () => {
  const rg = new RuntimeGenerator({
    name: 'test-runtime',
    targetDirectory: '/tmp/runtime'
  })

  const firstApplication = new ApplicationGenerator()
  firstApplication.setConfig({
    isRuntimeContext: false
  })
  rg.addApplication(firstApplication, 'first-service')

  rg.setConfig({
    port: 3043,
    logLevel: 'debug'
  })

  await rg.prepare()
  const packageJson = JSON.parse(rg.getFileObject('package.json').contents)
  assert.equal(packageJson.name, 'test-runtime')
  assert.deepStrictEqual(packageJson.scripts, {
    dev: 'wattpm dev',
    start: 'wattpm start',
    build: 'wattpm build'
  })
  assert.deepStrictEqual(packageJson.workspaces, ['applications/*'])
})

test('RuntimeGenerator - should have applications plugin dependencies in package.json', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  firstApplication.setConfig({
    isRuntimeContext: false
  })
  await firstApplication.addPackage({
    name: '@fastify/helmet',
    options: []
  })
  rg.addApplication(firstApplication, 'first-service')

  rg.setConfig({
    port: 3043,
    logLevel: 'debug'
  })

  const output = await rg.prepare()
  // runtime package.json has the application dependencies
  const packageJson = JSON.parse(rg.getFileObject('package.json').contents)
  assert.equal(packageJson.dependencies['@fastify/helmet'], 'latest')

  assert.deepEqual(output, {
    targetDirectory: '/tmp/runtime',
    env: {
      PLT_FIRST_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
      PLT_FIRST_SERVICE_SERVER_LOGGER_LEVEL: 'info',
      PLT_FIRST_SERVICE_PORT: 3042,
      PLT_MANAGEMENT_API: true,
      PLT_SERVER_LOGGER_LEVEL: 'debug'
    }
  })
})

test('RuntimeGenerator - should create a runtime with 1 application and 1 db', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  firstApplication.setConfig({
    env: {
      APPLICATION_1: 'foo'
    }
  })
  rg.addApplication(firstApplication, 'first-service')

  // adding another application
  const secondApplication = new ApplicationGenerator()
  secondApplication.setConfig({
    env: {
      APPLICATION_2: 'foo'
    }
  })
  rg.addApplication(secondApplication, 'second-service')

  rg.setConfig({
    port: 3043
  })

  const output = await rg.prepare()

  assert.deepEqual(output, {
    targetDirectory: '/tmp/runtime',
    env: {
      PLT_FIRST_SERVICE_APPLICATION_1: 'foo',
      PLT_FIRST_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
      PLT_FIRST_SERVICE_SERVER_LOGGER_LEVEL: 'info',
      PLT_FIRST_SERVICE_PORT: 3042,
      PLT_SECOND_SERVICE_APPLICATION_2: 'foo',
      PLT_SECOND_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
      PLT_SECOND_SERVICE_SERVER_LOGGER_LEVEL: 'info',
      PLT_SECOND_SERVICE_PORT: 3043,
      PLT_MANAGEMENT_API: true,
      PLT_SERVER_LOGGER_LEVEL: 'info'
    }
  })

  // should list only runtime files
  const runtimeFileList = rg.listFiles()
  assert.deepEqual(runtimeFileList, ['package.json', 'watt.config.mjs', '.env', '.env.sample', '.gitignore'])

  // applications have correct target directory
  assert.equal(
    firstApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', firstApplication.config.applicationName)
  )
  assert.equal(
    secondApplication.targetDirectory,
    join(rg.targetDirectory, 'applications', secondApplication.config.applicationName)
  )
})

test('RuntimeGenerator - should create a runtime with 2 applications and 2 gateways', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  // adding one application
  const firstApplication = new ApplicationGenerator()
  rg.addApplication(firstApplication, 'first-service')

  // adding another application
  const secondApplication = new ApplicationGenerator()
  rg.addApplication(secondApplication, 'second-service')

  // adding gateways
  const firstGateway = new GatewayGenerator()
  rg.addApplication(firstGateway, 'first-gateway')
  const secondGateway = new GatewayGenerator()
  rg.addApplication(secondGateway, 'second-gateway')

  rg.setConfig({
    port: 3043
  })

  await rg.prepare()

  // double check config files
  const firstGatewayConfigFileJson = firstGateway.generatedConfig
  assert.deepEqual(firstGatewayConfigFileJson.gateway.applications, [
    {
      id: 'first-service'
    },
    {
      id: 'second-service'
    }
  ])

  const secondGatewayConfigFileJson = secondGateway.generatedConfig
  assert.deepEqual(secondGatewayConfigFileJson.gateway.applications, [
    {
      id: 'first-service'
    },
    {
      id: 'second-service'
    }
  ])
})

test('RuntimeGenerator - should preserve explicit application ports', async () => {
  const rg = new RuntimeGenerator({
    targetDirectory: '/tmp/runtime'
  })

  const firstApplication = new ApplicationGenerator()
  const secondApplication = new ApplicationGenerator()
  const thirdApplication = new ApplicationGenerator()
  secondApplication.setConfig({ port: 3000 })
  thirdApplication.setConfig({ port: 0 })
  rg.addApplication(firstApplication, 'first-service')
  rg.addApplication(secondApplication, 'second-service')
  rg.addApplication(thirdApplication, 'third-service')

  const { env } = await rg.prepare()

  assert.deepEqual(env, {
    PLT_FIRST_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
    PLT_FIRST_SERVICE_SERVER_LOGGER_LEVEL: 'info',
    PLT_FIRST_SERVICE_PORT: 3042,
    PLT_SECOND_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
    PLT_SECOND_SERVICE_SERVER_LOGGER_LEVEL: 'info',
    PLT_SECOND_SERVICE_PORT: 3000,
    PLT_THIRD_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
    PLT_THIRD_SERVICE_SERVER_LOGGER_LEVEL: 'info',
    PLT_THIRD_SERVICE_PORT: 0,
    PLT_MANAGEMENT_API: true,
    PLT_SERVER_LOGGER_LEVEL: 'info'
  })
})

test('RuntimeGenerator - add applications to an existing folder', async t => {
  const targetDirectory = await mkdtemp(join(tmpdir(), 'platformatic-runtime-generator-'))

  t.after(async () => {
    await safeRemove(targetDirectory)
  })

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    // adding one application
    const firstApplication = new ApplicationGenerator()
    rg.addApplication(firstApplication, 'first-service')

    // adding another application
    const secondApplication = new ApplicationGenerator()
    rg.addApplication(secondApplication, 'second-service')

    rg.setConfig({
      port: 3043
    })

    await rg.prepare()
    await rg.writeFiles()
  }

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    // adding another application
    const thirdApplication = new ApplicationGenerator()
    rg.addApplication(thirdApplication, 'first-service')

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory,
      env: {
        PLT_FIRST_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
        PLT_FIRST_SERVICE_SERVER_LOGGER_LEVEL: 'info',
        PLT_FIRST_SERVICE_PORT: 3042,
        PLT_SECOND_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
        PLT_SECOND_SERVICE_SERVER_LOGGER_LEVEL: 'info',
        PLT_SECOND_SERVICE_PORT: '3043',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PLT_MANAGEMENT_API: 'true'
      }
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['watt.config.mjs', '.env', '.env.sample'])

    // applications have correct target directory
    assert.equal(
      thirdApplication.targetDirectory,
      join(rg.targetDirectory, 'applications', thirdApplication.config.applicationName)
    )
  }
})

test('RuntimeGenerator - add applications to an existing folder (web/)', async t => {
  const targetDirectory = await mkdtemp(join(tmpdir(), 'platformatic-runtime-generator-'))
  t.after(async () => {
    await safeRemove(targetDirectory)
  })

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    rg.setConfig({
      autoload: 'web'
    })

    // adding one application
    const firstApplication = new ApplicationGenerator()
    rg.addApplication(firstApplication, 'first-service')

    // adding another application
    const secondApplication = new ApplicationGenerator()
    rg.addApplication(secondApplication, 'second-service')

    rg.setConfig({
      port: 3043
    })

    await rg.prepare()
    await rg.writeFiles()
  }

  {
    const rg = new RuntimeGenerator({
      targetDirectory
    })

    // adding another application
    const thirdApplication = new ApplicationGenerator()
    rg.addApplication(thirdApplication, 'first-service')

    const output = await rg.prepare()

    assert.deepEqual(output, {
      targetDirectory,
      env: {
        PLT_FIRST_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
        PLT_FIRST_SERVICE_SERVER_LOGGER_LEVEL: 'info',
        PLT_FIRST_SERVICE_PORT: 3042,
        PLT_SECOND_SERVICE_SERVER_HOSTNAME: '0.0.0.0',
        PLT_SECOND_SERVICE_SERVER_LOGGER_LEVEL: 'info',
        PLT_SECOND_SERVICE_PORT: '3043',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PLT_MANAGEMENT_API: 'true'
      }
    })

    // should list only runtime files
    const runtimeFileList = rg.listFiles()
    assert.deepEqual(runtimeFileList, ['watt.config.mjs', '.env', '.env.sample'])

    // applications have correct target directory
    assert.equal(
      thirdApplication.targetDirectory,
      join(rg.targetDirectory, 'web', thirdApplication.config.applicationName)
    )
  }
})

test('WrappedGenerator - should create valid environment files', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(join(root, '.env'), 'A=1', 'utf-8')

  const generator = new WrappedGenerator({ module: '@platformatic/runtime', targetDirectory: root })
  await generator.prepare()

  const env = generator.getFileObject('.env')
  const envSample = generator.getFileObject('.env.sample')

  assert.deepStrictEqual(env.contents.split(/\r?\n/), [
    'A=1',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])

  assert.deepStrictEqual(envSample.contents.split(/\r?\n/), [
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])
})

test('should support adding env variables only to .env and not .env.sample', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(join(root, '.env'), 'A=1', 'utf-8')

  const generator = new WrappedGenerator({ module: '@platformatic/runtime', targetDirectory: root })
  generator.addEnvVar('FOO', '1', { overwrite: false, default: true })
  generator.addEnvVar('FOO', 'A', { overwrite: true, default: false })
  await generator.prepare()

  const env = generator.getFileObject('.env')
  const envSample = generator.getFileObject('.env.sample')

  assert.deepStrictEqual(env.contents.split(/\r?\n/), [
    'A=1',
    'FOO=A',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])

  assert.deepStrictEqual(envSample.contents.split(/\r?\n/), [
    'FOO=1',
    'PLT_SERVER_LOGGER_LEVEL=info',
    'PLT_MANAGEMENT_API=true'
  ])
})

test('WrappedGenerator - should create a valid configuration', async t => {
  const root = await createTemporaryDirectory(t)

  const generator = new WrappedGenerator({ module: '@platformatic/next', targetDirectory: root })
  await generator.prepare()

  /*
    The wrapped single-app root. v3 nested the runtime settings under a `runtime` key inside the
    application's own configuration; v4 has no such block, so they are the root's own.
  */
  const wattJson = generator.getFileObject('watt.config.mjs')

  assert.ok(wattJson.contents.includes('export default {'), wattJson.contents)
  assert.ok(wattJson.contents.includes('level: process.env.PLT_SERVER_LOGGER_LEVEL'), wattJson.contents)
  assert.ok(!wattJson.contents.includes('runtime:'), wattJson.contents)
})

test('WrappedGenerator - should create a valid package.json', async t => {
  const version = await getPlatformaticVersion()
  const root = await createTemporaryDirectory(t)

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        scripts: {
          build: 'foo',
          other: 'bar'
        },
        dependencies: {
          something: '^1',
          platformatic: 'foo',
          '@platformatic/runtime': 'latest'
        },
        engines: {
          foo: 'bar',
          node: '14'
        },
        rest: 'FOO',
        devDependencies: {
          baz: '123'
        }
      },
      null,
      2
    ),
    'utf-8'
  )

  const generator = new WrappedGenerator({
    module: '@platformatic/runtime',
    targetDirectory: root
  })
  generator.setConfig({
    buildCommand: 'build',
    devCommand: 'dev'
  })
  await generator.prepare()

  const packageJson = generator.getFileObject('package.json')

  const expected = {
    name: basename(root),
    scripts: {
      build: 'foo',
      other: 'bar',
      dev: 'dev',
      start: 'wattpm start'
    },
    dependencies: {
      '@platformatic/runtime': `^${version}`,
      platformatic: `^${version}`,
      something: '^1',
      wattpm: `^${version}`
    },
    devDependencies: {
      baz: '123'
    },
    rest: 'FOO',
    engines: {
      foo: 'bar',
      node: '>=22.19.0'
    }
  }

  assert.deepStrictEqual(packageJson.contents.split(/\r?\n/), JSON.stringify(expected, null, 2).split(/\r?\n/))
})

test('RuntimeGenerator - what it writes loads', async t => {
  const root = await createTemporaryDirectory(t)
  const rg = new RuntimeGenerator({ targetDirectory: root, applicationsFolder: 'web' })

  rg.addApplication(new ApplicationGenerator(), 'api')
  rg.setConfig({ targetDirectory: root })

  await rg.prepare()
  await rg.writeFiles()

  await createDirectory(join(root, 'node_modules', '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../service'), join(root, 'node_modules/@platformatic/service'), 'dir')

  /*
    Through the real loader, because that is the only thing that says the output is right. Every
    value in these files is an expression reading the .env written beside them, so this is also what
    checks that the two agree: a scaffolded project whose configuration cannot be read, or reads
    back as the text of a placeholder, is what this asserts against.
  */
  const config = await loadRuntimeConfiguration(join(root, 'watt.config.mjs'), null, { command: 'start' })
  const application = config.applications.find(entry => entry.id === 'api')

  assert.deepStrictEqual(config.logger.level, 'info')
  // A boolean position, and v4 validates without coercion: the string 'true' would not be accepted.
  assert.deepStrictEqual(config.managementApi, true)
  assert.deepStrictEqual(application.resolvedConfig.server.port, 3042)
  assert.deepStrictEqual(application.resolvedConfig.server.logger.level, 'info')
})

test('WrappedGenerator - what it writes loads, and runs the application it wrapped', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'wrapped-app', type: 'module', main: 'index.js' }),
    'utf-8'
  )
  await writeFile(join(root, 'index.js'), 'export default {}\n', 'utf-8')

  const generator = new WrappedGenerator({ module: '@platformatic/node', targetDirectory: root })
  await generator.prepare()
  await generator.writeFiles()

  await createDirectory(join(root, 'node_modules', '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), join(root, 'node_modules/@platformatic/node'), 'dir')

  const config = await loadRuntimeConfiguration(join(root, 'watt.config.js'), null, { command: 'start' })

  /*
    The application is the point. A wrapped root carrying only the runtime settings loads perfectly
    well and describes a runtime with nothing in it -- it would start none of the code it was
    wrapped around, and nothing about the file would say so.
  */
  assert.deepStrictEqual(
    config.applications.map(entry => entry.id),
    ['wrapped-app']
  )
  assert.deepStrictEqual(config.logger.level, 'info')
})

/*
  The wizard used to load a legacy root through the v3 reader and rewrite it -- the module form
  over a .json file. It refuses now, with the hint every other v4 entry point gives: migrate owns
  that conversion, refusals and divergence reports included.
*/
/*
  The evaluated configuration arrives with autoload expanded into explicit entries carrying this
  machine's absolute paths. Editing an autoload-based root must not append them: the next boot
  discovers those directories again, and an absolute path baked into the file breaks on the next
  machine.
*/
test('RuntimeGenerator - editing an autoload root does not bake the expanded entries in', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'existing', type: 'commonjs' }), 'utf-8')
  await writeFile(join(root, '.env'), '', 'utf-8')
  await writeFile(
    join(root, 'watt.config.mjs'),
    "export default {\n  autoload: { path: 'web' },\n  applications: []\n}\n",
    'utf-8'
  )
  await mkdir(join(root, 'web/present'), { recursive: true })
  await writeFile(join(root, 'web/present/package.json'), JSON.stringify({ name: 'present', type: 'module' }), 'utf-8')
  await writeFile(join(root, 'web/present/watt.config.js'), "export default { module: '@platformatic/node' }\n", 'utf-8')

  const rg = new RuntimeGenerator({ targetDirectory: root, applicationsFolder: 'web' })
  rg.setConfig({ targetDirectory: root })

  await rg.populateFromExistingConfig()
  rg.updateRuntimeConfig({
    ...rg.generatedConfig,
    autoload: { path: 'web' },
    applications: [
      { id: 'present', path: join(root, 'web/present') },
      { id: 'outside', path: './elsewhere' }
    ]
  })

  const written = rg.files.find(file => file.file === 'watt.config.mjs').contents

  assert.ok(!written.includes("id: 'present'"), written)
  assert.ok(written.includes("id: 'outside'"), written)
})

test('RuntimeGenerator - a legacy root is refused with the migrate hint', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'legacy' }), 'utf-8')
  await writeFile(
    join(root, 'watt.json'),
    JSON.stringify({ $schema: 'https://schemas.platformatic.dev/wattpm/2.65.0.json', autoload: { path: 'web' } }),
    'utf-8'
  )

  const rg = new RuntimeGenerator({ targetDirectory: root, applicationsFolder: 'web' })
  rg.setConfig({ targetDirectory: root })

  await assert.rejects(
    () => rg.populateFromExistingConfig(),
    error => {
      assert.strictEqual(error.code, 'PLT_LEGACY_CONFIGURATION_FILE')
      assert.ok(error.message.includes('migrate'), error.message)
      return true
    }
  )
})

test('RuntimeGenerator - editing an existing root keeps what it says', async t => {
  const root = await createTemporaryDirectory(t)

  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'existing', type: 'commonjs' }), 'utf-8')
  await writeFile(join(root, '.env'), 'PLT_SERVER_LOGGER_LEVEL=info\n', 'utf-8')
  await writeFile(
    join(root, 'watt.config.mjs'),
    [
      'export default {',
      '  // a comment the user wrote',
      '  logger: {',
      '    level: process.env.PLT_SERVER_LOGGER_LEVEL',
      '  },',
      "  applications: [{ id: 'first', path: './first' }]",
      '}',
      ''
    ].join('\n'),
    'utf-8'
  )

  const rg = new RuntimeGenerator({ targetDirectory: root, applicationsFolder: 'web' })
  rg.setConfig({ targetDirectory: root })

  await rg.populateFromExistingConfig()
  rg.updateRuntimeConfig({
    ...rg.generatedConfig,
    applications: [
      { id: 'first', path: './first' },
      { id: 'second', path: './second' }
    ]
  })

  /*
    An edit, not a re-rendering. Re-emitting from the evaluated configuration would write the level
    this machine resolves -- 'info' -- where the user wrote a reference, and drop their comment with
    it: their configuration would silently stop reading its own environment.
  */
  const written = rg.files.find(file => file.file === 'watt.config.mjs').contents

  assert.ok(written.includes('level: process.env.PLT_SERVER_LOGGER_LEVEL'), written)
  assert.ok(written.includes('a comment the user wrote'), written)
  assert.ok(written.includes("id: 'second'"), written)
})
